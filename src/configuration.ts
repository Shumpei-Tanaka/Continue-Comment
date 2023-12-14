import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';

const stringToCursorStyle = (Config: vscode.WorkspaceConfiguration, style: string, def: vscode.TextEditorCursorStyle) => {
    switch (Config.get<string>(style)) {
    case "Line": return vscode.TextEditorCursorStyle.Line;
    case "LineThin": return vscode.TextEditorCursorStyle.LineThin;
    case "Block": return vscode.TextEditorCursorStyle.Block;
    case "BlockOutline": return vscode.TextEditorCursorStyle.BlockOutline;
    case "UnderLine": return vscode.TextEditorCursorStyle.Underline;
    case "UnderLineThin": return vscode.TextEditorCursorStyle.UnderlineThin;
    default: return def;
    }
}


const getActiveConfiguration = (section: string): vscode.WorkspaceConfiguration => {
    const activeLanguageId = vscode.window.activeTextEditor?.document.languageId;
    if (activeLanguageId)
    {
        const languageScope = {languageId: activeLanguageId};
        const languageSpecificConfiguration = vscode.workspace.getConfiguration(section, languageScope);
        return languageSpecificConfiguration;
    }
    return vscode.workspace.getConfiguration(section);
}

function escapeRegex(string: string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export class Config {
    public alwaysOn :boolean | undefined;
    public viewModeAsCursor :boolean | undefined;
    get defaultCursorStyle(): vscode.TextEditorCursorStyle {
        const editorConfiguration = getActiveConfiguration("editor");
        return stringToCursorStyle(editorConfiguration, "cursorStyle",
            vscode.TextEditorCursorStyle.Line);
        };
    public secondaryCursorStyle: vscode.TextEditorCursorStyle | undefined;
    public commentregex:RegExp|undefined;
    public constructor(
        alwaysOn:boolean|undefined,
        viewModeAsCursor:boolean|undefined,
        secondaryCursorStyle:vscode.TextEditorCursorStyle | undefined,
        commentregex:RegExp|undefined) {
            this.alwaysOn = alwaysOn;
            this.viewModeAsCursor = viewModeAsCursor;
            this.secondaryCursorStyle = secondaryCursorStyle;
            this.commentregex = commentregex;
    }
    public static load () {
        const activeEditor = vscode.window.activeTextEditor;
        const commentmodeConfig = vscode.workspace.getConfiguration("continue-comment");
        const commentConfigHandler = new CommentConfigHandler();
        const commentCfg = commentConfigHandler.getCommentConfig(activeEditor?.document.languageId);
        const commentLineDelimiter = commentCfg?.lineComment;
        let regex : RegExp | undefined ;
        if(commentLineDelimiter){
            regex = new RegExp(`\s*${escapeRegex(commentLineDelimiter)}.*`, "ig");
        }
        else{
            regex = undefined;
        }
    
        return new Config(
            commentmodeConfig.get<boolean>("alwaysOn"),
            commentmodeConfig.get<boolean>("viewModeAsCursor"),
            (() => {
                return stringToCursorStyle(commentmodeConfig, "secondaryCursorStyle",
                    vscode.TextEditorCursorStyle.Underline);
            })(),
            regex
        );
    }
    public reload () {
        const newConfig = Config.load();
    
        if (
            this.alwaysOn === newConfig.alwaysOn &&
            this.viewModeAsCursor === newConfig.viewModeAsCursor &&
            this.defaultCursorStyle === newConfig.defaultCursorStyle &&
            this.secondaryCursorStyle === newConfig.secondaryCursorStyle &&
            this.commentregex === newConfig.commentregex
            ){
            return false;
        }
    
        this.alwaysOn = newConfig.alwaysOn;
        this.viewModeAsCursor = newConfig.viewModeAsCursor;
        this.secondaryCursorStyle = newConfig.secondaryCursorStyle;
        this.commentregex = newConfig.commentregex;
        return true;
    }
}


interface CommentConfig {
    lineComment?: string;
    blockComment?: [string, string];
}

export class CommentConfigHandler {
    private readonly languageToConfigPath = new Map<string, string>();
    private readonly commentConfig = new Map<string, CommentConfig | undefined>();

    public constructor() {
        this.updateLanguagesDefinitions();
    }

    /**
        * Generate a map of language configuration file by language defined by extensions
        * External extensions can override default configurations os VSCode
        */
    public updateLanguagesDefinitions() {
        this.commentConfig.clear();

        for (const extension of vscode.extensions.all) {
            const packageJSON = extension.packageJSON as any;
            if (packageJSON.contributes && packageJSON.contributes.languages) {
                for (const language of packageJSON.contributes.languages) {
                    if (language.configuration) {
                        const configPath = path.join(extension.extensionPath, language.configuration);
                        this.languageToConfigPath.set(language.id, configPath);
                    }
                }
            }
        }
    }

    /**
        * Return the comment Config for `languageCode`
        * @param languageCode The short code of the current language
        */
    public getCommentConfig(languageCode: string | undefined): CommentConfig | undefined {
        if (languageCode === undefined){
            return undefined;
        }
        if (this.commentConfig.has(languageCode)) {
            return this.commentConfig.get(languageCode);
        }

        if (!this.languageToConfigPath.has(languageCode)) {
            return undefined;
        }

        const file = this.languageToConfigPath.get(languageCode) as string;

        const content = fs.readFileSync(file, { encoding: 'utf8' });

        try {
            // Using normal JSON because json5 behaved buggy.
            // Might need JSON5 in the future to parse language jsons with comments.
            const Config = JSON.parse(content);

            this.commentConfig.set(languageCode, Config.comments);
            return Config.comments;
        } catch (error) {
            this.commentConfig.set(languageCode, undefined);
            return undefined;
        }
    }
}