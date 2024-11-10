import type { ZrLexerOptions } from "../lexer";
import ZrLexer from "../lexer";
import ZrTextStream from "../text-stream";
import { isToken, ZrTokenFlag, ZrTokenKind } from "../tokens/tokens";

export interface ZrThemeOptions {
	BooleanLiteral?: string;
	CommentColor?: string;
	ControlCharacters: string;
	FunctionColor?: string;
	KeywordColor: string;
	LabelColor?: string;
	NumberColor: string;
	OperatorColor: string;
	StringColor: string;
	VariableColor: string;
}

const DARK_THEME: ZrThemeOptions = {
	BooleanLiteral: "#56B6C2",
	ControlCharacters: "rgb(50, 50, 50)",
	FunctionColor: "#E0E0E0",
	KeywordColor: "#57AFE3",
	NumberColor: "#56B6C2",
	OperatorColor: "#5F6672",
	StringColor: "#79C36C",
	VariableColor: "#B57EDC",
	// CommentColor: "#5F6672",
};

function font(text: string, color: string | undefined): string {
	return color ? `<font color="${color}">${text}</font>` : text;
}

export default class ZrRichTextHighlighter {
	private readonly lexer: ZrLexer;
	constructor(
		source: string,
		private readonly options: ZrThemeOptions = DARK_THEME,
		lexerOptions: Partial<ZrLexerOptions> = {
			CommandNames: [],
			ExperimentalSyntaxHighlighter: true,
			SyntaxHighlighterLexer: true,
		},
	) {
		const stream = new ZrTextStream(source);
		this.lexer = new ZrLexer(stream, lexerOptions);
	}

	// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls. Split into smaller functions.
	public parse(): string {
		let str = "";
		const { lexer, options } = this;

		while (lexer.hasNext()) {
			const token = lexer.next();

			if (!token) {
				break;
			}

			if (isToken(token, ZrTokenKind.Boolean)) {
				str += font(token.rawText, options.BooleanLiteral ?? options.OperatorColor);
			} else if (isToken(token, ZrTokenKind.String)) {
				const { endCharacter, flags, startCharacter, value } = token;
				if (startCharacter !== undefined) {
					str += font(
						`${startCharacter}${font(value, options.StringColor)}${endCharacter ?? ""}`,
						options.OperatorColor,
					);
				} else if (flags !== 0) {
					if ((flags & ZrTokenFlag.FunctionName) !== 0) {
						str += font(value, options.FunctionColor ?? options.VariableColor);
					} else if ((flags & ZrTokenFlag.Label) !== 0) {
						str += font(value, options.LabelColor ?? options.VariableColor);
					}
				} else {
					str += value;
				}
			} else if (isToken(token, ZrTokenKind.InterpolatedString)) {
				const { closed, quotes, values, variables } = token;
				const resulting = new Array<string>();
				for (let key = 0; key < values.size(); key++) {
					const value = values[key];
					resulting.push(font(value, options.StringColor));

					const matchingVariable = variables[key];
					if (matchingVariable !== undefined) {
						resulting.push(font(`$${matchingVariable}`, options.VariableColor));
					}
				}

				str += font(
					`${quotes}${font(resulting.join(""), options.StringColor)}${closed ? quotes : ""}`,
					options.OperatorColor,
				);
			} else if (isToken(token, ZrTokenKind.Number)) {
				str += font(token.rawText, options.NumberColor);
			} else if (isToken(token, ZrTokenKind.Identifier)) {
				if ((token.flags & ZrTokenFlag.FunctionName) !== 0) {
					str += font(token.value, options.FunctionColor ?? options.NumberColor);
				} else if ((token.flags & ZrTokenFlag.VariableDeclaration) !== 0) {
					str += font(token.value, options.VariableColor);
				} else {
					str += font(
						(token.flags & ZrTokenFlag.VariableDollarIdentifier) !== 0
							? `$${token.value}`
							: token.value,
						options.VariableColor,
					);
				}
			} else if (
				isToken(token, ZrTokenKind.Operator) ||
				isToken(token, ZrTokenKind.Special)
			) {
				str += font(token.value, options.OperatorColor);
			} else if (isToken(token, ZrTokenKind.Keyword)) {
				str += font(token.value, options.KeywordColor);
			} else if (isToken(token, ZrTokenKind.EndOfStatement)) {
				if (token.value === "\n") {
					str += font("¬", options.ControlCharacters);
					str += token.value;
				} else if (token.value !== "\r") {
					str += font(token.value, options.OperatorColor);
				}
			} else if (isToken(token, ZrTokenKind.Whitespace)) {
				str += token.value === " " ? font("·", options.ControlCharacters) : token.value;
			} else if (isToken(token, ZrTokenKind.Option)) {
				str += font(`${token.prefix ?? ""}${token.value}`, options.KeywordColor);
			} else if (isToken(token, ZrTokenKind.PropertyAccess)) {
				str += font(
					(token.flags & ZrTokenFlag.VariableDollarIdentifier) !== 0
						? `$${token.value}`
						: token.value,
					options.VariableColor,
				);
				for (const property of token.properties) {
					str +=
						font(".", options.OperatorColor) +
						(property.match("%d+")[0] !== undefined
							? font(property, options.NumberColor)
							: font(property, options.VariableColor));
				}
			} else if (isToken(token, ZrTokenKind.Comment)) {
				str += font(token.value, options.CommentColor ?? options.OperatorColor);
			} else {
				str += tostring(token.value);
			}
		}

		return str;
	}
}
