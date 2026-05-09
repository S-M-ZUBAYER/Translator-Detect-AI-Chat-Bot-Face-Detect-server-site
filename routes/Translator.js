
// const express = require("express");
// const { response } = require("express");
// const cors = require("cors");
// require("dotenv").config();
// const port = process.env.PORT || 5000;



// const app = express();
// app.use(cors());
// app.use(express.json());
// const router = express.Router();





// router.get('/translate', (req, res) => {
//     res.send("I am running as the server site of ZUSS Chat translator server site");
// });

// app.use((req, res, next) => {
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     next();
// });

// const OpenAI = require("openai");

// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });

// // router.post("/translate", async (req, res) => {
// //     try {
// //         const { target, text } = req.body;

// //         // Basic validation
// //         if (!text || !target) {
// //             return res.status(400).json({ error: "Please provide both text and target language." });
// //         }

// //         // Instruction message for translation
// //         const trans = `(Please don't think deeply, just translate) "${text}". Without considering whether it is in the same language or not, please translate into ${target}.`;

// //         // OpenAI API call
// //         const response = await openai.createChatCompletion({
// //             model: "gpt-3.5-turbo",
// //             messages: [{ role: "user", content: trans }],
// //         });

// //         // Success response
// //         const translatedText = response?.data?.choices?.[0]?.message?.content;
// //         if (translatedText) {
// //             res.status(200).json({ data: translatedText });
// //         } else {
// //             res.status(500).json({ error: "Translation failed. Please try again." });
// //         }
// //     } catch (err) {
// //         console.error("Translation error:", err);
// //         res.status(500).json({ error: "Internal server error." });
// //     }
// // });


// router.post("/translate", async (req, res) => {
//     try {
//         const { target, text } = req.body;

//         if (!text || !target) {
//             return res.status(400).json({ error: "Both text and target language are required." });
//         }

//         const isToChinese = target.toLowerCase() === "chinese" || target.toLowerCase() === "zh";

//         // Special case: if translating to Chinese and "ribbon" is in the text
//         const prompt = isToChinese && text.toLowerCase().includes("ribbon")
//             ? `Translate the following text to ${target}, and make sure to use the word '色带' for 'ribbon': "${text}"`
//             : `Translate the following text to ${target}: "${text}"`;

//         const response = await openai.chat.completions.create({
//     model: "gpt-3.5-turbo",
//     messages: [{ role: "user", content: prompt }],
// });

// const translatedText = response.choices[0].message.content.trim();


//         if (translatedText) {
//             res.status(200).json({ data: translatedText });
//         } else {
//             res.status(500).json({ error: "Failed to translate text." });
//         }

//     } catch (error) {
//         console.error("Translation error:", error.message);
//         res.status(500).json({ error: "Internal server error." });
//     }
// });

// app.use(router);

// module.exports = router;


const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());
const router = express.Router();

router.get('/translate', (req, res) => {
    res.send("I am running as the server site of ZUSS Chat translator server site");
});

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * @swagger
 * /translate:
 *   post:
 *     summary: Translate text to a target language
 *     description: >
 *       Translates the given text into the specified target language using GPT-3.5-turbo.
 *       Special handling ensures "ribbon" is translated to "色带" when translating to Chinese.
 *     tags: [Translate]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, target]
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Please replace the ribbon cartridge."
 *               target:
 *                 type: string
 *                 example: "Chinese"
 *                 description: Target language name (e.g. "Chinese", "Thai", "English")
 *     responses:
 *       200:
 *         description: Translation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: string
 *                   example: "请更换色带。"
 *       400:
 *         description: Missing text or target language
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Translation failed or internal server error
 */

/**
 * @swagger
 * /sync-trans-reading-time:
 *   post:
 *     summary: Rewrite subtitle translation to reduce TTS duration distance
 *     description: >
 *       Rewrites the English `trans` field while keeping the same meaning.
 *
 *       This API does NOT generate audio. It uses text length estimation first.
 *       After your system generates real TTS audio, call this API again with
 *       `actualAudioMs` if the audio duration is too short or too long.
 *
 *       Recommended flow:
 *       1. First call without `actualAudioMs`.
 *       2. Generate TTS audio from returned `trans`.
 *       3. Measure real audio duration.
 *       4. If difference is more than 500ms, call again with `actualAudioMs`.
 *
 *       Use `targetMode: "segment"` for final audio/video sync.
 *     tags: [Translate]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start, end, text, trans]
 *             properties:
 *               start:
 *                 type: number
 *                 example: 118.545
 *               end:
 *                 type: number
 *                 example: 127.985
 *               text:
 *                 type: string
 *                 example: "গোলা হতে পারে রহস্যময় এই আগুনের গোলা নিয়ে সবার মধ্যে বিষয়ের সৃষ্টি হলেও সেটি আসলে কি তা কেউই নিশ্চিত করে বলতে পারছেন না"
 *               trans:
 *                 type: string
 *                 example: "It could be a fireball, but no one can say for sure what this mysterious fireball is."
 *               targetMode:
 *                 type: string
 *                 enum: [segment, sourceText]
 *                 default: segment
 *                 example: segment
 *                 description: >
 *                   `segment` matches start/end slot duration.
 *                   `sourceText` matches estimated Bangla source reading duration.
 *               toleranceMs:
 *                 type: number
 *                 default: 500
 *                 example: 500
 *               actualAudioMs:
 *                 type: number
 *                 nullable: true
 *                 example: 7008
 *                 description: >
 *                   Real generated TTS audio duration in milliseconds.
 *                   Provide this only when correcting a failed segment.
 *     responses:
 *       200:
 *         description: Translation generated or corrected successfully
 *       400:
 *         description: Missing or invalid required fields
 *       422:
 *         description: Model could not return a valid candidate
 *       500:
 *         description: Internal server error
 */

router.post("/translate", async (req, res) => {
    try {
        const { target, text } = req.body;
        if (!text || !target) {
            return res.status(400).json({ error: "Both text and target language are required." });
        }

        const isToChinese = target.toLowerCase() === "chinese" || target.toLowerCase() === "zh";
        const prompt =
            isToChinese && text.toLowerCase().includes("ribbon")
                ? `Translate the following text to ${target}, and make sure to use the word '色带' for 'ribbon': "${text}"`
                : `Translate the following text to ${target}: "${text}"`;

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
        });

        const translatedText = response.choices[0].message.content.trim();
        if (translatedText) {
            res.status(200).json({ data: translatedText });
        } else {
            res.status(500).json({ error: "Failed to translate text." });
        }
    } catch (error) {
        console.error("Translation error:", error.message);
        res.status(500).json({ error: "Internal server error." });
    }
});



router.post("/sync-trans-reading-time", async (req, res) => {
    try {
        const {
            start,
            end,
            text,
            trans,
            targetMode = "segment",
            toleranceMs = 500,
            actualAudioMs = null
        } = req.body;

        if (
            typeof start !== "number" ||
            typeof end !== "number" ||
            !text ||
            !trans
        ) {
            return res.status(400).json({
                error: "start, end, text, and trans are required."
            });
        }

        if (end <= start) {
            return res.status(400).json({
                error: "end time must be greater than start time."
            });
        }

        if (!["segment", "sourceText"].includes(targetMode)) {
            return res.status(400).json({
                error: 'targetMode must be either "segment" or "sourceText".'
            });
        }

        if (
            actualAudioMs !== null &&
            (typeof actualAudioMs !== "number" || actualAudioMs <= 0)
        ) {
            return res.status(400).json({
                error: "actualAudioMs must be a positive number when provided."
            });
        }

        const BANGLA_WPM = 130;

        /**
         * This value is only for first guess.
         * Real duration correction uses actualAudioMs.
         *
         * 360ms per word = around 166 WPM.
         * This is closer for many TTS voices than 145 WPM text reading.
         */
        const DEFAULT_ENGLISH_MS_PER_WORD = 360;

        const CANDIDATE_COUNT = 8;
        const MAX_TEXT_ATTEMPTS = 2;

        function countWords(value, lang = "en") {
            if (!value || typeof value !== "string") return 0;

            if (lang === "en") {
                const matches = value.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)?/g);
                return matches ? matches.length : 0;
            }

            return value.trim().split(/\s+/).filter(Boolean).length;
        }

        function countMatches(value, regex) {
            const matches = value.match(regex);
            return matches ? matches.length : 0;
        }

        function estimateBanglaReadingMs(value) {
            const clean = value.trim();
            const wordCount = countWords(clean, "bn");
            const commaCount = countMatches(clean, /[,،，]/g);
            const sentenceEndCount = countMatches(clean, /[.!?।]/g);

            const wordMs = (wordCount / BANGLA_WPM) * 60 * 1000;
            const commaPauseMs = commaCount * 140;
            const sentencePauseMs = Math.max(1, sentenceEndCount) * 350;

            return Math.round(wordMs + commaPauseMs + sentencePauseMs);
        }

        function safeJsonParse(content) {
            try {
                return JSON.parse(content);
            } catch {
                const match = content.match(/\{[\s\S]*\}/);
                if (!match) return null;

                try {
                    return JSON.parse(match[0]);
                } catch {
                    return null;
                }
            }
        }

        function extractCandidates(parsed) {
            if (!parsed || !Array.isArray(parsed.candidates)) return [];

            return parsed.candidates
                .map(item => {
                    if (typeof item === "string") return item.trim();
                    if (item && typeof item.trans === "string") return item.trans.trim();
                    return null;
                })
                .filter(Boolean);
        }

        function getEstimatedEnglishMs(candidate, msPerWord) {
            const clean = candidate.trim();
            const words = countWords(clean, "en");
            const commaCount = countMatches(clean, /[,،，]/g);
            const sentenceEndCount = countMatches(clean, /[.!?]/g);

            return Math.round(
                words * msPerWord +
                commaCount * 120 +
                Math.max(1, sentenceEndCount) * 250
            );
        }

        function analyzeCandidate(candidate, targetMs, targetWords, minWords, maxWords, msPerWord) {
            const wordCount = countWords(candidate, "en");
            const estimatedMs = getEstimatedEnglishMs(candidate, msPerWord);
            const estimatedDiffMs = Math.abs(estimatedMs - targetMs);
            const wordDiff = Math.abs(wordCount - targetWords);

            const isInWordRange = wordCount >= minWords && wordCount <= maxWords;

            return {
                trans: candidate,
                wordCount,
                estimatedMs,
                estimatedDiffMs,
                wordDiff,
                isInWordRange
            };
        }

        function chooseBestCandidate(candidates, targetMs, targetWords, minWords, maxWords, msPerWord, mode) {
            const analyzed = candidates.map(candidate =>
                analyzeCandidate(candidate, targetMs, targetWords, minWords, maxWords, msPerWord)
            );

            const inRange = analyzed.filter(item => item.isInWordRange);

            /**
             * Important:
             * In expand mode, prefer enough words.
             * In shorten mode, prefer not too many words.
             */
            const pool = inRange.length ? inRange : analyzed;

            pool.sort((a, b) => {
                if (mode === "expand") {
                    if (a.wordCount !== b.wordCount) return b.wordCount - a.wordCount;
                }

                if (mode === "shorten") {
                    if (a.wordCount !== b.wordCount) return a.wordCount - b.wordCount;
                }

                if (a.wordDiff !== b.wordDiff) return a.wordDiff - b.wordDiff;
                return a.estimatedDiffMs - b.estimatedDiffMs;
            });

            return {
                best: pool[0] || null,
                analyzed
            };
        }

        function buildWordPlan({
            mode,
            targetMs,
            actualAudioMs,
            currentWordCount,
            realTiming
        }) {
            let targetWords;
            let msPerWord = DEFAULT_ENGLISH_MS_PER_WORD;

            if (actualAudioMs && currentWordCount > 0) {
                msPerWord = Math.max(
                    220,
                    Math.min(520, Math.round(actualAudioMs / currentWordCount))
                );
            }

            if (!realTiming) {
                /**
                 * First generation:
                 * Aim slightly high because your logs show many segments become too short.
                 */
                targetWords = Math.ceil(targetMs / msPerWord) + 1;

                return {
                    msPerWord,
                    targetWords,
                    minWords: Math.max(3, targetWords),
                    maxWords: targetWords + 3
                };
            }

            /**
             * Correction generation:
             * Use real measured audio to calculate better target words.
             */
            const exactWordsNeeded = Math.ceil(targetMs / msPerWord);

            if (realTiming.isTooShort) {
                const extraWordsByShortage = Math.ceil(realTiming.shortageMs / msPerWord);

                targetWords = Math.max(
                    exactWordsNeeded,
                    currentWordCount + extraWordsByShortage
                );

                /**
                 * Add one safety word for large shortage.
                 */
                if (realTiming.shortageMs >= 1500) {
                    targetWords += 1;
                }

                if (realTiming.shortageMs >= 3000) {
                    targetWords += 2;
                }

                return {
                    msPerWord,
                    targetWords,
                    minWords: Math.max(3, targetWords),
                    maxWords: targetWords + 3
                };
            }

            if (realTiming.isTooLong) {
                const wordsToRemove = Math.ceil(realTiming.overflowMs / msPerWord);

                targetWords = Math.min(
                    exactWordsNeeded,
                    Math.max(3, currentWordCount - wordsToRemove)
                );

                return {
                    msPerWord,
                    targetWords,
                    minWords: Math.max(3, targetWords - 2),
                    maxWords: Math.max(3, targetWords)
                };
            }

            targetWords = exactWordsNeeded;

            return {
                msPerWord,
                targetWords,
                minWords: Math.max(3, targetWords - 1),
                maxWords: targetWords + 1
            };
        }

        async function callOpenAIForCandidates({
            mode,
            targetMs,
            targetSeconds,
            targetWords,
            minWords,
            maxWords,
            realTiming,
            attempt
        }) {
            let modeInstruction = "";

            if (mode === "initial") {
                modeInstruction = `
Create a fresh English dubbing translation from the Bangla source.
Do not simply edit the old English translation.
The old English translation is only a rough meaning reference.
The result must be ${minWords} to ${maxWords} words.
Aim for exactly ${targetWords} words.
`;
            }

            if (mode === "expand") {
                modeInstruction = `
The current English TTS audio is TOO SHORT.

Current English translation:
"${trans}"

Current real audio duration: ${actualAudioMs}ms
Target duration: ${targetMs}ms
Short by: ${realTiming.shortageMs}ms

Rewrite it LONGER while keeping the same meaning.
The result must be ${minWords} to ${maxWords} words.
Aim for exactly ${targetWords} words.

Do not add random filler.
Expand only by restoring natural details from the Bangla source.
`;
            }

            if (mode === "shorten") {
                modeInstruction = `
The current English TTS audio is TOO LONG.

Current English translation:
"${trans}"

Current real audio duration: ${actualAudioMs}ms
Target duration: ${targetMs}ms
Overflow by: ${realTiming.overflowMs}ms

Rewrite it SHORTER while keeping the same meaning.
The result must be ${minWords} to ${maxWords} words.
Aim for exactly ${targetWords} words.

Do not remove important meaning.
`;
            }

            const prompt = `
You are a professional Bangla to English voice-dubbing translation editor.

Goal:
Create an English translation that keeps the same meaning and reduces duration distance.

Target:
- Target mode: ${targetMode}
- Target duration: ${targetMs}ms
- Target seconds: ${targetSeconds}s
- Tolerance goal: ±${toleranceMs}ms
- Required word count: ${minWords} to ${maxWords} words
- Best word count: exactly ${targetWords} words

Strict rules:
- Translate from the Bangla source.
- Use the old/current English only as a reference.
- Keep the same meaning and expression.
- Do not add unrelated facts.
- Do not remove important facts.
- Natural spoken English for dubbing.
- Do not return a candidate below ${minWords} words.
- Do not return a candidate above ${maxWords} words.
- If the Bangla text is incomplete, translate only what exists.
- Avoid too many commas because TTS adds pauses.

Timing rules:
- Do not only make it fit under the slot.
- It must try to get close to the target duration.
- If current audio is too short, expand the sentence.
- If current audio is too long, shorten the sentence.

${modeInstruction}

Attempt number: ${attempt}

Return exactly ${CANDIDATE_COUNT} candidates.
Return only valid JSON.

JSON format:
{
  "candidates": [
    { "trans": "candidate one" },
    { "trans": "candidate two" },
    { "trans": "candidate three" },
    { "trans": "candidate four" },
    { "trans": "candidate five" },
    { "trans": "candidate six" },
    { "trans": "candidate seven" },
    { "trans": "candidate eight" }
  ]
}
`;

            const response = await openai.chat.completions.create({
                model: process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: prompt
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            start,
                            end,
                            banglaText: text,
                            currentEnglishTranslation: trans,
                            targetMode,
                            targetMs,
                            targetSeconds,
                            toleranceMs,
                            mode,
                            actualAudioMs,
                            realTiming,
                            requiredWords: {
                                min: minWords,
                                max: maxWords,
                                target: targetWords
                            }
                        })
                    }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            });

            const raw = response.choices?.[0]?.message?.content?.trim() || "{}";
            const parsed = safeJsonParse(raw);

            return extractCandidates(parsed);
        }

        const slotMs = Math.round((end - start) * 1000);
        const segmentDuration = Number((slotMs / 1000).toFixed(2));
        const sourceTextReadingMs = estimateBanglaReadingMs(text);

        const targetMs =
            targetMode === "sourceText"
                ? sourceTextReadingMs
                : slotMs;

        const targetSeconds = Number((targetMs / 1000).toFixed(2));

        const currentWordCount = countWords(trans, "en");

        let mode = "initial";
        let realTiming = null;

        if (actualAudioMs !== null) {
            const diffMs = Math.abs(actualAudioMs - targetMs);

            realTiming = {
                actualAudioMs,
                targetMs,
                diffMs,
                shortageMs: Math.max(0, targetMs - actualAudioMs),
                overflowMs: Math.max(0, actualAudioMs - targetMs),
                isMatched: diffMs <= toleranceMs,
                isTooShort: actualAudioMs < targetMs - toleranceMs,
                isTooLong: actualAudioMs > targetMs + toleranceMs
            };

            if (realTiming.isMatched) {
                return res.status(200).json({
                    data: {
                        start,
                        end,
                        text,
                        oldTrans: trans,
                        trans,
                        action: "keep",
                        message: "Current audio already matches the target duration.",
                        timing: {
                            targetMode,
                            slotMs,
                            segmentDuration,
                            sourceTextReadingMs,
                            targetMs,
                            targetSeconds,
                            toleranceMs,
                            currentWordCount,
                            ...realTiming,
                            needsAudioCheck: false
                        }
                    }
                });
            }

            mode = realTiming.isTooShort ? "expand" : "shorten";
        }

        const wordPlan = buildWordPlan({
            mode,
            targetMs,
            actualAudioMs,
            currentWordCount,
            realTiming
        });

        let bestOverall = null;
        let analyzedOverall = [];

        for (let attempt = 1; attempt <= MAX_TEXT_ATTEMPTS; attempt++) {
            const candidates = await callOpenAIForCandidates({
                mode,
                targetMs,
                targetSeconds,
                targetWords: wordPlan.targetWords,
                minWords: wordPlan.minWords,
                maxWords: wordPlan.maxWords,
                realTiming,
                attempt
            });

            if (!candidates.length) {
                continue;
            }

            const { best, analyzed } = chooseBestCandidate(
                candidates,
                targetMs,
                wordPlan.targetWords,
                wordPlan.minWords,
                wordPlan.maxWords,
                wordPlan.msPerWord,
                mode
            );

            analyzedOverall = analyzed;

            if (best && (!bestOverall || best.wordDiff < bestOverall.wordDiff)) {
                bestOverall = best;
            }

            /**
             * If the selected candidate is already in target word range,
             * no need for another text-only retry.
             */
            if (best && best.isInWordRange) {
                break;
            }
        }

        if (!bestOverall) {
            return res.status(422).json({
                error: "Model returned no valid candidates.",
                data: {
                    start,
                    end,
                    text,
                    oldTrans: trans,
                    targetMode,
                    mode,
                    slotMs,
                    targetMs,
                    targetSeconds,
                    toleranceMs,
                    actualAudioMs,
                    realTiming,
                    wordPlan
                }
            });
        }

        return res.status(200).json({
            data: {
                start,
                end,
                text,
                oldTrans: trans,
                trans: bestOverall.trans,
                action: mode === "initial" ? "generate" : mode,
                message:
                    mode === "initial"
                        ? "Generated translation. Now generate TTS audio and measure actual duration."
                        : "Generated corrected translation. Regenerate TTS audio and measure again.",
                timing: {
                    targetMode,
                    slotMs,
                    segmentDuration,
                    sourceTextReadingMs,
                    targetMs,
                    targetSeconds,
                    toleranceMs,
                    mode,
                    actualAudioMs,
                    realTiming,
                    currentWordCount,
                    estimatedMsPerWordUsed: wordPlan.msPerWord,
                    targetEnglishWords: wordPlan.targetWords,
                    minWords: wordPlan.minWords,
                    maxWords: wordPlan.maxWords,
                    selectedWordCount: bestOverall.wordCount,
                    selectedEstimatedMs: bestOverall.estimatedMs,
                    selectedEstimatedDiffMs: bestOverall.estimatedDiffMs,
                    selectedIsInWordRange: bestOverall.isInWordRange,
                    needsAudioCheck: true
                },
                candidates: analyzedOverall
            }
        });

    } catch (error) {
        console.error("Sync translation error:", error);

        return res.status(500).json({
            error: "Internal server error.",
            message: error.message
        });
    }
});


app.use(router);
module.exports = router;