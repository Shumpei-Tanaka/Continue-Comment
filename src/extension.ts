// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { Config} from "./configuration";

const defaultMode = false;

const state = {
    global: defaultMode
};

let config:Config;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('load "continue-comment"');
    config = Config.load();

	let disposable = (
        vscode.commands.registerCommand('continue-comment.toggle', toggleCommand),
        vscode.workspace.onDidChangeTextDocument(typeCommand),
        vscode.window.onDidChangeActiveTextEditor(activeTextEditorChanged),
        vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration)
    );

	context.subscriptions.push(disposable);
}

const toggleCommand = () => {
    const textEditor = vscode.window.activeTextEditor;
    if (textEditor == null) {
        return;
    }

    toggleMode();
    activeTextEditorChanged(textEditor);
    commentIfIsNot();

}

const toggleMode = () => {
    const comment_mode = !getMode();

    state.global = comment_mode;
    return comment_mode;
}
const getMode = () => {
    if(config.alwaysOn){
        return true;
    }
    else{
        return state.global;
    }
}

const activeTextEditorChanged = (textEditor?: vscode.TextEditor) => {
    config.reload();
    if (textEditor === undefined) {
        return;
    }
    const mode = getMode();
    if (config.viewModeAsCursor)
    {
        textEditor.options.cursorStyle = mode
            ? config.secondaryCursorStyle
            : config.defaultCursorStyle;
    }
}

const onDidChangeConfiguration = () => {
    activeTextEditorChanged();
}

const shouldPerform = () => {
    const mode = getMode();
    return mode;
}

const typeCommand = (e: vscode.TextDocumentChangeEvent) => {
    const changed = e.contentChanges[0].text;
    if (!changed.includes("\n")){
        return;
    }
    commentContinue();

}
const commentIfIsNot = ()=>{
    if (!shouldPerform()) {
        return;
    }
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }
    const regex = config.commentregex;
    if(regex === undefined){
        return;
    }
    const curlineText = activeEditor.document.lineAt(activeEditor.selection.active.line);
    const isCurComment = regex.test(curlineText.text);
    if(!isCurComment)
    {
        commentLine();
    }
}
const commentContinue = () =>{
    if (!shouldPerform()) {
        return;
    }
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }
    const regex = config.commentregex;
    if(regex === undefined){
        return;
    }
    const curlineText = activeEditor.document.lineAt(activeEditor.selection.active.line+1);
    const prelineText = activeEditor.document.lineAt(activeEditor.selection.active.line);
    const isCurComment = regex.test(curlineText.text);
    const ispreComment = regex.test(prelineText.text);
    if(ispreComment && !isCurComment)
    {
        commentLine();
    }
}
const commentLine = ()=>{
    vscode.commands.executeCommand("editor.action.commentLine");
}



export function deactivate() {}
