"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const mathjs_1 = require("mathjs");
function activate(context) {
    console.log('Congratulations, your extension "enum-member-counter" is now active!');
    let disposable = vscode.languages.registerHoverProvider('cpp', {
        provideHover(document, position, token) {
            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);
            // console.log('Hover triggered for word:', word);
            // Check if the word is an enum member
            if (isEnumMember(document, word)) {
                const enumMemberValue = getEnumMemberValue(document, position);
                if (enumMemberValue !== undefined && enumMemberValue !== null) {
                    // console.log('enumMemberValue:', enumMemberValue);
                    // return new vscode.Hover("Enum Number : " + enumMemberValue.toString());
                    const markdownContent = new vscode.MarkdownString(`Enum Number : `);
                    markdownContent.supportHtml = true;
                    markdownContent.appendMarkdown('<span style="color:#d5e39d;">' + enumMemberValue.toString() +
                        " /  " + numberToHex(enumMemberValue) + '</span>');
                    // markdownContent.appendText();
                    return new vscode.Hover(markdownContent);
                }
            }
            return null;
        },
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function isEnumMember(document, word) {
    // Customize this condition based on your desired criteria for identifying enum members
    return /^[A-Za-z_]\w*$/.test(word);
}
function getEnumMemberValue(document, position) {
    const line = position.line;
    const currentLine = document.lineAt(line).text;
    let enumDeclarationStartLine = findEnumDeclarationStartLine(document, line);
    if (enumDeclarationStartLine !== -1) {
        const enumName = extractEnumName(document.lineAt(enumDeclarationStartLine).text);
        const enumMemberName = extractEnumMemberName(currentLine);
        if (enumName && enumMemberName) {
            const enumMemberValue = findEnumMemberValue(document, enumDeclarationStartLine, enumMemberName);
            if (enumMemberValue !== -1) {
                return enumMemberValue;
            }
        }
    }
    return undefined;
}
function findEnumDeclarationStartLine(document, line) {
    while (line >= 0) {
        const lineText = document.lineAt(line).text;
        // lineText.includes('enum ')
        if (containsEnumDeclaration(lineText) && !startsWithComment(lineText)) {
            return line;
        }
        line--;
    }
    return -1;
}
function extractEnumName(lineText) {
    const match = lineText.match(/enum\s+(\w+)/);
    return match ? match[1] : undefined;
}
function extractEnumMemberName(lineText) {
    // const match = lineText.match(/[A-Za-z_]\w+/);
    const match = lineText.match(/[A-Za-z_]\w*/);
    return match ? match[0] : undefined;
}
function findEnumMemberValue(document, startLine, memberName) {
    const enumDeclarationEndLine = findEnumDeclarationEndLine(document, startLine);
    if (enumDeclarationEndLine > startLine && enumDeclarationEndLine !== -1) {
        let memberValue = -1;
        let hasReachedMember = false;
        let keyMap = new Map();
        for (let line = startLine + 1; line < enumDeclarationEndLine; line++) {
            const lineText = document.lineAt(line).text.trim();
            // handle comments
            if (startsWithComment(lineText)) {
                continue;
            }
            const match = lineText.match(/^(\w+)\s*(?:=\s*)?(.*)/);
            if (match) {
                const currentMemberName = match[1];
                const currentValue = match[2].trim();
                // if (!currentValue) {
                //   continue;
                // }
                if (!currentValue && currentMemberName === memberName) {
                    memberValue = memberValue < 0 ? 0 : memberValue + 1;
                }
                else if (currentValue === ',') {
                    // hasReachedMember = true;
                    memberValue = memberValue < 0 ? 0 : memberValue + 1;
                    // memberValue = memberValue + 1;
                }
                else if (Number(tryGetNumber(currentValue))) {
                    memberValue = parseEnumMemberValue(currentValue);
                }
                else { // handle currentValue assign as Enum Name
                    let searchKey = removeStringAfterCommas(currentValue);
                    let keyFind = keyMap.has(searchKey) ? keyMap.get(searchKey) : 0;
                    memberValue = keyFind ? keyFind : 0;
                }
                // if finding match member Return
                if (currentMemberName === memberName) {
                    // return memberValue !== undefined ? memberValue + 1 : 0;
                    return memberValue;
                }
                // store key
                keyMap.set(currentMemberName, memberValue);
                // if (!currentValue || currentValue === ',') {
                //   // hasReachedMember = true;
                //   memberValue = memberValue !== undefined ? memberValue + 1 : 0;
                // } else {
                //   memberValue = parseEnumMemberValue(currentValue);
                // }
            }
        }
    }
    return -1;
}
function removeStringAfterCommas(input) {
    return input.split(',')[0];
}
function findEnumDeclarationEndLine(document, startLine) {
    const lineCount = document.lineCount;
    for (let line = startLine + 1; line < lineCount; line++) {
        const lineText = document.lineAt(line).text.trim();
        if (lineText.includes('}')) {
            return line;
        }
    }
    return -1;
}
function parseEnumMemberValue(value) {
    // Handle hexadecimal and decimal values
    return evaluateFormula(value);
    // return value.startsWith('0x') ? parseInt(value, 16) : parseInt(value);
}
function startsWithComment(input) {
    const trimmedInput = input.trim(); // Remove leading and trailing spaces
    return /^(\/\/|\*|\/)/.test(trimmedInput);
}
function containsEnumDeclaration(input) {
    return /\benum\s+\w*\s*{/.test(input);
}
function numberToHex(num) {
    return `0x${num.toString(16).toUpperCase()}`;
}
function tryGetNumber(formula) {
    try {
        // 使用 eval 函数求值
        return (0, mathjs_1.evaluate)(formula.replace(/,/g, ''));
    }
    catch (error) {
        // console.error('公式求值出错:', error);
        return 'undefined';
    }
}
function evaluateFormula(formula) {
    try {
        // 使用 eval 函数求值
        return (0, mathjs_1.evaluate)(formula.replace(/,/g, ''));
    }
    catch (error) {
        // console.error('公式求值出错:', error);
        return 0;
    }
}
//# sourceMappingURL=extension.js.map