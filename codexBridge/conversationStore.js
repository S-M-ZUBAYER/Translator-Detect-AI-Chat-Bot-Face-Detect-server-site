const {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} = require('crypto');
const {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} = require('fs/promises');
const path = require('path');
const { HttpError } = require('./errors');

const UUID_PATTERN = /^[a-f0-9-]{36}$/;

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function sameHash(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function publicAttachment(attachment) {
  const {
    storage,
    evidence,
    sha256,
    ...value
  } = attachment;
  return {
    ...value,
    ...(evidence?.summary ? { summary: evidence.summary } : {}),
  };
}

function publicMessage(message) {
  return JSON.parse(JSON.stringify(message));
}

function cloneConversation(conversation) {
  return JSON.parse(JSON.stringify(conversation));
}

function publicConversation(conversation) {
  return {
    id: conversation.id,
    productId: conversation.productId,
    productName: conversation.productName,
    knowledgeVersion: conversation.knowledgeVersion,
    locale: conversation.locale,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    expiresAt: conversation.expiresAt,
    attachments: conversation.attachments.map(publicAttachment),
  };
}

class ConversationStore {
  constructor({ directory, ttlMs }) {
    this.directory = path.resolve(directory);
    this.conversationsDirectory = path.join(this.directory, 'conversations');
    this.mediaDirectory = path.join(this.directory, 'media');
    this.temporaryDirectory = path.join(this.directory, 'tmp');
    this.ttlMs = ttlMs;
    this.conversations = new Map();
    this.locks = new Map();
    this.removing = new Set();
    this.cleanupTimer = null;
    this.ready = this.initialize();
  }

  async initialize() {
    await mkdir(this.conversationsDirectory, { recursive: true });
    await mkdir(this.mediaDirectory, { recursive: true });
    await rm(this.temporaryDirectory, { recursive: true, force: true });
    await mkdir(this.temporaryDirectory, { recursive: true });
    for (const name of await readdir(this.conversationsDirectory)) {
      if (!UUID_PATTERN.test(name.replace(/\.json$/u, '')) || !name.endsWith('.json')) {
        continue;
      }
      try {
        const value = JSON.parse(
          await readFile(path.join(this.conversationsDirectory, name), 'utf8'),
        );
        if (value.id !== name.slice(0, -5) || !Array.isArray(value.messages)) {
          continue;
        }
        value.attachments = Array.isArray(value.attachments)
          ? value.attachments
          : [];
        let recovered = false;
        for (const attachment of value.attachments) {
          if (['queued', 'processing'].includes(attachment.status)) {
            attachment.status = 'failed';
            attachment.error = {
              code: 'PROCESS_INTERRUPTED',
              message: 'Media processing was interrupted. Upload the file again.',
            };
            recovered = true;
          }
        }
        for (const message of value.messages) {
          if (['queued', 'answering'].includes(message.status)) {
            message.status = 'failed';
            message.error = {
              code: 'PROCESS_INTERRUPTED',
              message: 'Answer processing was interrupted. Send the question again.',
            };
            recovered = true;
          }
        }
        this.conversations.set(value.id, value);
        if (recovered) await this.persist(value);
      } catch (error) {
        console.warn(`Codex Bridge conversation load skipped ${name}: ${error.message}`);
      }
    }
    await this.cleanupExpired();
    this.cleanupTimer = setInterval(
      () => void this.cleanupExpired().catch((error) => {
        console.warn('Codex Bridge conversation cleanup failed:', error.message);
      }),
      Math.min(this.ttlMs, 60 * 60 * 1000),
    );
    this.cleanupTimer.unref?.();
  }

  filePath(id) {
    return path.join(this.conversationsDirectory, `${id}.json`);
  }

  async persist(conversation) {
    const target = this.filePath(conversation.id);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(conversation), { flag: 'wx' });
    await rename(temporary, target);
  }

  mutate(id, operation) {
    if (this.removing.has(id)) {
      return Promise.reject(
        new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.'),
      );
    }
    const previous = this.locks.get(id) || Promise.resolve();
    const current = previous.then(async () => {
      if (this.removing.has(id)) {
        throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }
      const stored = this.conversations.get(id);
      if (!stored) {
        throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }
      const conversation = cloneConversation(stored);
      const result = await operation(conversation);
      conversation.updatedAt = new Date().toISOString();
      conversation.expiresAt = new Date(Date.now() + this.ttlMs).toISOString();
      await this.persist(conversation);
      this.conversations.set(id, conversation);
      return result;
    });
    const lock = current.catch(() => {});
    this.locks.set(id, lock);
    lock.finally(() => {
      if (this.locks.get(id) === lock) this.locks.delete(id);
    });
    return current;
  }

  async create({ product, locale = 'en' }) {
    await this.ready;
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const now = new Date().toISOString();
    const conversation = {
      id,
      tokenHash: tokenHash(token),
      productId: product.id,
      productName: product.name,
      knowledgeVersion: product.knowledgeVersion,
      locale,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + this.ttlMs).toISOString(),
      attachments: [],
      messages: [],
    };
    this.conversations.set(id, conversation);
    try {
      await this.persist(conversation);
    } catch (error) {
      if (this.conversations.get(id) === conversation) {
        this.conversations.delete(id);
      }
      throw error;
    }
    return { conversation: publicConversation(conversation), token };
  }

  async authorize(id, token, { touch = false } = {}) {
    await this.ready;
    if (!UUID_PATTERN.test(id || '')) {
      throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    const conversation = this.removing.has(id)
      ? undefined
      : this.conversations.get(id);
    if (!conversation) {
      throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    if (Date.parse(conversation.expiresAt) <= Date.now()) {
      await this.remove(id);
      throw new HttpError(410, 'CONVERSATION_EXPIRED', 'This conversation has expired.');
    }
    if (!sameHash(conversation.tokenHash, tokenHash(token || ''))) {
      throw new HttpError(403, 'CONVERSATION_FORBIDDEN', 'Invalid conversation token.');
    }
    if (touch) await this.mutate(id, () => undefined);
    return conversation;
  }

  getInternal(id) {
    return this.removing.has(id) ? undefined : this.conversations.get(id);
  }

  publicConversation(conversation) {
    return publicConversation(conversation);
  }

  publicMessages(conversation) {
    return conversation.messages.map(publicMessage);
  }

  publicAttachment(attachment) {
    return publicAttachment(attachment);
  }

  async mediaPath(id) {
    await this.ready;
    if (!UUID_PATTERN.test(id || '')) throw new Error('Invalid conversation ID.');
    if (this.removing.has(id) || !this.conversations.has(id)) {
      throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    const directory = path.join(this.mediaDirectory, id);
    await mkdir(directory, { recursive: true });
    return directory;
  }

  async addAttachment(id, attachment) {
    return this.mutate(id, (conversation) => {
      if (conversation.attachments.length >= 50) {
        throw new HttpError(
          409,
          'ATTACHMENT_LIMIT_REACHED',
          'Start a new conversation before uploading more media.',
        );
      }
      conversation.attachments.push(attachment);
      return attachment;
    });
  }

  async updateAttachment(id, attachmentId, update) {
    return this.mutate(id, (conversation) => {
      const attachment = conversation.attachments.find(
        (item) => item.id === attachmentId,
      );
      if (!attachment) {
        throw new HttpError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
      }
      Object.assign(attachment, update, { updatedAt: new Date().toISOString() });
      return attachment;
    });
  }

  async discardAttachment(id, attachmentId) {
    return this.mutate(id, (conversation) => {
      const index = conversation.attachments.findIndex(
        (item) => item.id === attachmentId,
      );
      if (index !== -1) conversation.attachments.splice(index, 1);
    });
  }

  attachment(conversation, attachmentId) {
    const attachment = conversation.attachments.find(
      (item) => item.id === attachmentId,
    );
    if (!attachment) {
      throw new HttpError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
    }
    return attachment;
  }

  recentMediaAttachments(conversation, beforeMessageId) {
    const beforeIndex = conversation.messages.findIndex(
      (message) => message.id === beforeMessageId,
    );
    const end = beforeIndex === -1 ? conversation.messages.length : beforeIndex;
    for (let index = end - 1; index >= 0; index -= 1) {
      const message = conversation.messages[index];
      if (
        message.status !== 'completed'
        || !Array.isArray(message.attachmentIds)
        || !message.attachmentIds.length
      ) continue;
      const attachments = message.attachmentIds
        .map((attachmentId) =>
          conversation.attachments.find((item) => item.id === attachmentId))
        .filter(
          (attachment) =>
            attachment
            && attachment.status === 'ready'
            && attachment.evidence
            && attachment.evidence.analysisVersion !== 'codex-vision-staged-v1'
            && (
              attachment.evidence.summary
              || attachment.evidence.ocrText
              || attachment.evidence.transcript
              || attachment.evidence.observations?.length
            ),
        );
      if (attachments.length) return attachments;
    }
    return [];
  }

  async createMessage(id, { clientMessageId, text, attachmentIds }) {
    return this.mutate(id, (conversation) => {
      const duplicate = conversation.messages.find(
        (message) => message.clientMessageId === clientMessageId,
      );
      if (duplicate) return { message: duplicate, created: false };
      if (
        conversation.messages.some((message) =>
          ['queued', 'answering'].includes(message.status),
        )
      ) {
        throw new HttpError(
          409,
          'CONVERSATION_BUSY',
          'Wait for the current answer before sending another question.',
        );
      }
      if (conversation.messages.length >= 100) {
        throw new HttpError(
          409,
          'MESSAGE_LIMIT_REACHED',
          'Start a new conversation to continue asking questions.',
        );
      }
      const attachments = attachmentIds.map((attachmentId) =>
        this.attachment(conversation, attachmentId),
      );
      if (attachments.some((attachment) => attachment.status !== 'ready')) {
        throw new HttpError(
          409,
          'ATTACHMENTS_NOT_READY',
          'Wait until every attachment has finished processing.',
        );
      }
      const now = new Date().toISOString();
      const message = {
        id: randomUUID(),
        clientMessageId,
        text,
        attachmentIds,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      };
      conversation.messages.push(message);
      return { message, created: true };
    });
  }

  message(conversation, messageId) {
    const message = conversation.messages.find((item) => item.id === messageId);
    if (!message) {
      throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
    }
    return message;
  }

  async updateMessage(id, messageId, update) {
    return this.mutate(id, (conversation) => {
      const message = this.message(conversation, messageId);
      Object.assign(message, update, { updatedAt: new Date().toISOString() });
      return message;
    });
  }

  async discardMessage(id, messageId) {
    return this.mutate(id, (conversation) => {
      const index = conversation.messages.findIndex(
        (item) => item.id === messageId && item.status === 'queued',
      );
      if (index !== -1) conversation.messages.splice(index, 1);
    });
  }

  history(conversation, beforeMessageId) {
    const history = [];
    for (const message of conversation.messages) {
      if (message.id === beforeMessageId) break;
      if (message.status !== 'completed' || !message.result?.answer) continue;
      if (message.text) history.push({ role: 'user', content: message.text });
      else history.push({ role: 'user', content: '[Customer provided media]' });
      history.push({ role: 'assistant', content: message.result.answer });
    }
    let characters = 0;
    const selected = [];
    for (const item of history.slice(-20).reverse()) {
      if (characters + item.content.length > 24000) continue;
      selected.push(item);
      characters += item.content.length;
    }
    return selected.reverse();
  }

  async remove(id) {
    if (!UUID_PATTERN.test(id || '')) return;
    if (this.removing.has(id)) {
      await (this.locks.get(id) || Promise.resolve());
      return;
    }
    this.removing.add(id);
    const previous = this.locks.get(id) || Promise.resolve();
    const current = previous.then(async () => {
      await unlink(this.filePath(id)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      const media = path.join(this.mediaDirectory, id);
      if (path.dirname(media) !== this.mediaDirectory) {
        throw new Error('Unsafe conversation media path.');
      }
      await rm(media, { recursive: true, force: true });
      this.conversations.delete(id);
    });
    const lock = current.catch(() => {});
    this.locks.set(id, lock);
    try {
      await current;
    } finally {
      this.removing.delete(id);
      if (this.locks.get(id) === lock) this.locks.delete(id);
    }
  }

  async cleanupExpired() {
    await Promise.resolve();
    const expired = [...this.conversations.values()]
      .filter((conversation) => Date.parse(conversation.expiresAt) <= Date.now())
      .map((conversation) => conversation.id);
    for (const id of expired) await this.remove(id);
  }

  close() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

module.exports = {
  ConversationStore,
  UUID_PATTERN,
  publicAttachment,
  publicConversation,
  publicMessage,
};
