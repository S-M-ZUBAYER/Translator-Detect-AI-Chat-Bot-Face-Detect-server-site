const fs = require("fs-extra");

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getNextQuestionNumber(text) {
    const matches = [...(text || "").matchAll(/\bQ-(\d+)[:.]/gi)];
    const maxQuestionNumber = matches.reduce((max, match) => {
        const questionNumber = parseInt(match[1], 10);
        return Number.isFinite(questionNumber) ? Math.max(max, questionNumber) : max;
    }, 0);

    return maxQuestionNumber + 1;
}

function normalizeFaqItems(items) {
    if (!Array.isArray(items)) return [];

    return items
        .map(item => ({
            question: String(item?.question || "").trim(),
            answer: String(item?.answer || "").trim(),
            variants: Array.isArray(item?.variants)
                ? item.variants.map(variant => String(variant || "").trim()).filter(Boolean)
                : [],
        }))
        .filter(item => item.question && item.answer);
}

function formatFaqItems(items, startQuestionNumber) {
    return items.map((item, index) => {
        const lines = [`Q-${startQuestionNumber + index}: ${item.question}`];

        if (item.variants.length) {
            lines.push("Alternative Questions:");
            item.variants.forEach(variant => lines.push(`- ${variant}`));
            lines.push("");
        }

        lines.push("Answer:");
        lines.push(item.answer);

        return lines.join("\n");
    }).join("\n\n");
}

async function appendFaqItemsToTextFile({ outputFilePath, category = "FAQ", items }) {
    const normalizedItems = normalizeFaqItems(items);
    if (!normalizedItems.length) {
        return {
            success: false,
            status: 400,
            message: "At least one valid question and answer is required.",
        };
    }

    fs.ensureDirSync(require("path").dirname(outputFilePath));

    const currentContent = fs.existsSync(outputFilePath)
        ? fs.readFileSync(outputFilePath, "utf8")
        : "";
    const startQuestionNumber = getNextQuestionNumber(currentContent);
    const formattedText = `${formatFaqItems(normalizedItems, startQuestionNumber)}\n\n\n\n\n`;
    const sectionHeader = `\n===== ${String(category).toUpperCase()} SECTION =====\n`;
    const categoryRegex = new RegExp(
        `===== ${escapeRegExp(String(category).toUpperCase())} SECTION =====([\\s\\S]*?)(?=====|$)`,
        "i"
    );

    let nextContent = currentContent;
    if (categoryRegex.test(nextContent)) {
        nextContent = nextContent.replace(categoryRegex, (match, existingSectionText) => {
            return `===== ${String(category).toUpperCase()} SECTION =====\n${existingSectionText.trim()}\n\n${formattedText}`;
        });
    } else {
        nextContent += `${sectionHeader}${formattedText}`;
    }

    fs.writeFileSync(outputFilePath, nextContent, "utf8");

    return {
        success: true,
        filePath: outputFilePath,
        allText: nextContent,
        added: normalizedItems.map((item, index) => ({
            id: `Q-${startQuestionNumber + index}`,
            question: item.question,
        })),
    };
}

module.exports = {
    appendFaqItemsToTextFile,
};
