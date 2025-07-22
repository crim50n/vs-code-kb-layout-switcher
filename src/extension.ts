"use strict";
import * as vscode from 'vscode';

// --- LAYOUT DEFINITIONS ---
const LAYOUT_PAIRS: { [key: string]: { from: any, to: any, fromLang: 'cyrillic' | 'latin' } } = {
    'ru-en': {
        from: { "`": "ё", "q": "й", "w": "ц", "e": "у", "r": "к", "t": "е", "y": "н", "u": "г", "i": "ш", "o": "щ", "p": "з", "[": "х", "]": "ъ", "a": "ф", "s": "ы", "d": "в", "f": "а", "g": "п", "h": "р", "j": "о", "k": "л", "l": "д", ";": "ж", "'": "э", "z": "я", "x": "ч", "c": "с", "v": "м", "b": "и", "n": "т", "m": "ь", ",": "б", ".": "ю", "/": ".", "~": "Ё", "Q": "Й", "W": "Ц", "E": "У", "R": "К", "T": "Е", "Y": "Н", "U": "Г", "I": "Ш", "O": "Щ", "P": "З", "{": "Х", "}": "Ъ", "A": "Ф", "S": "Ы", "D": "В", "F": "А", "G": "П", "H": "Р", "J": "О", "K": "Л", "L": "Д", ":": "Ж", "\"": "Э", "Z": "Я", "X": "Ч", "C": "С", "V": "М", "B": "И", "N": "Т", "M": "Ь", "<": "Б", ">": "Ю", "?": ",", "@": "\"", "#": "№", "$": ";", "^": ":", "&": "?", "|": "/" },
        to: {}, // `to` will be auto-generated
        fromLang: 'latin' // The `from` map converts from Latin
    },
    'ua-en': {
        from: { "`": "'", "q": "й", "w": "ц", "e": "у", "r": "к", "t": "е", "y": "н", "u": "г", "i": "ш", "o": "щ", "p": "з", "[": "х", "]": "ї", "a": "ф", "s": "і", "d": "в", "f": "а", "g": "п", "h": "р", "j": "о", "k": "л", "l": "д", ";": "ж", "'": "є", "z": "я", "x": "ч", "c": "с", "v": "м", "b": "и", "n": "т", "m": "ь", ",": "б", ".": "ю", "/": ".", "~": "’", "Q": "Й", "W": "Ц", "E": "У", "R": "К", "T": "Е", "Y": "Н", "U": "Г", "I": "Ш", "O": "Щ", "P": "З", "{": "Х", "}": "Ї", "A": "Ф", "S": "І", "D": "В", "F": "А", "G": "П", "H": "Р", "J": "О", "K": "Л", "L": "Д", ":": "Ж", "\"": "Є", "Z": "Я", "X": "Ч", "C": "С", "V": "М", "B": "И", "N": "Т", "M": "Ь", "<": "Б", ">": "Ю", "?": ",", "@": "\"", "#": "₴", "$": ";", "^": ":", "&": "?", "|": "/" },
        to: {},
        fromLang: 'latin'
    },
    'de-qwertz': {
        from: { "y": "z", "z": "y", "Y": "Z", "Z": "Y", "[": "ü", "{": "Ü", "]": "+", "}": "*", ";": "ö", ":": "Ö", "'": "ä", "\"": "Ä", "-": "ß", "_": "?" },
        to: {},
        fromLang: 'latin'
    }
};

// Auto-generate the reverse maps for all layout pairs
for (const key in LAYOUT_PAIRS) {
    const pair = LAYOUT_PAIRS[key];
    for (const fromKey in pair.from) {
        pair.to[pair.from[fromKey]] = fromKey;
    }
}

// --- Helper Functions ---

function detectDirection(text: string, fromLang: 'cyrillic' | 'latin'): 'to' | 'from' {
    let fromChars = 0;
    let toChars = 0;
    
    // Simple detection based on a few sample characters from each alphabet
    const latinRegex = /[a-zA-Z]/;
    const cyrillicRegex = /[а-яА-ЯёЁіІїЇєЄ]/;

    const fromRegex = fromLang === 'latin' ? latinRegex : cyrillicRegex;
    const toRegex = fromLang === 'latin' ? cyrillicRegex : latinRegex;

    for (const char of text) {
        if (fromRegex.test(char)) fromChars++;
        else if (toRegex.test(char)) toChars++;
    }

    return toChars > fromChars ? 'from' : 'to';
}

function transformText(text: string, map: { [key: string]: string }): string {
    return text.split('').map(char => map[char] || char).join('');
}


class SwitchLayoutHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.ProviderResult<vscode.Hover> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty || !editor.selection.contains(position)) {
            return;
        }
        const markdown = new vscode.MarkdownString(`[Switch Layout](command:keyswitch.switch "Switch keyboard layout")`);
        markdown.isTrusted = true;
        return new vscode.Hover(markdown, editor.selection);
    }
}


// --- Activation Function ---

export function activate(context: vscode.ExtensionContext) {
    const switchCommand = vscode.commands.registerCommand('keyswitch.switch', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            return;
        }

        // --- NEW: Load layout from settings ---
        const config = vscode.workspace.getConfiguration('keyswitch');
        const activeLayoutKey = config.get<string>('activeLayout', 'ru-en'); // Default to 'ru-en'
        const layoutPair = LAYOUT_PAIRS[activeLayoutKey];

        if (!layoutPair) {
            vscode.window.showErrorMessage(`Layout switcher: The selected layout "${activeLayoutKey}" was not found.`);
            return;
        }

        const selection = editor.selection;
        const textToSwitch = editor.document.getText(selection);

        // Determine direction and select the appropriate map
        const direction = detectDirection(textToSwitch, layoutPair.fromLang);
        const transformMap = direction === 'to' ? layoutPair.from : layoutPair.to;

        const switchedText = transformText(textToSwitch, transformMap);

        editor.edit(editBuilder => {
            editBuilder.replace(selection, switchedText);
        });
    });

    const hoverProvider = vscode.languages.registerHoverProvider(
        { scheme: 'file' },
        new SwitchLayoutHoverProvider()
    );

    context.subscriptions.push(switchCommand, hoverProvider);
}