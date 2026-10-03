const { HttpError } = require('./errors');

class TaskQueue {
  constructor({ concurrency, maxQueued, code, name }) {
    this.concurrency = concurrency;
    this.maxQueued = maxQueued;
    this.code = code;
    this.name = name;
    this.active = 0;
    this.waiting = [];
    this.closed = false;
  }

  add(task) {
    if (this.closed) {
      throw new HttpError(503, 'QUEUE_CLOSED', `${this.name} is shutting down.`);
    }
    if (this.waiting.length >= this.maxQueued) {
      throw new HttpError(
        429,
        this.code,
        `${this.name} is busy. Please try again shortly.`,
      );
    }
    const promise = new Promise((resolve, reject) => {
      this.waiting.push({ task, resolve, reject });
    });
    this.pump();
    return promise;
  }

  pump() {
    while (!this.closed && this.active < this.concurrency && this.waiting.length) {
      const job = this.waiting.shift();
      this.active += 1;
      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.active = Math.max(0, this.active - 1);
          this.pump();
        });
    }
  }

  status() {
    return {
      active: this.active,
      queued: this.waiting.length,
      concurrency: this.concurrency,
      maxQueued: this.maxQueued,
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    const error = new HttpError(
      503,
      'QUEUE_CLOSED',
      `${this.name} is shutting down.`,
    );
    for (const job of this.waiting.splice(0)) job.reject(error);
  }
}

module.exports = { TaskQueue };
