import { isBooleanLiteral, isNumberLiteral, isStringExpression } from "../nodes/guards";
import type { Node } from "../nodes/node-types";

export type AstPrimitiveType = "boolean" | "number" | "string" | "switch";

interface AstBaseDefinition {
	readonly type: ReadonlyArray<AstPrimitiveType>;
}

export interface AstArgumentDefinition extends AstBaseDefinition {
	variadic?: true;
}
export interface AstOptionDefinition extends AstBaseDefinition {}

export interface AstCommandDefinition {
	readonly args?: ReadonlyArray<AstArgumentDefinition>;
	readonly children?: ReadonlyArray<AstCommandDefinition>;
	readonly command: string;
	readonly options?: Readonly<Record<string, AstOptionDefinition>>;
}
export type AstCommandDefinitions = ReadonlyArray<AstCommandDefinition>;

export function nodeMatchAstDefinitionType(node: Node, typeName: AstPrimitiveType): MatchResult {
	if (typeName === "string" && isStringExpression(node)) {
		return { matches: true, matchType: typeName };
	} else if (typeName === "number" && isNumberLiteral(node)) {
		return { matches: true, matchType: typeName };
	} else if (typeName === "boolean" && isBooleanLiteral(node)) {
		return { matches: true, matchType: typeName };
	} else if (typeName === "switch") {
		return { matches: true, matchType: typeName };
	}

	return { matches: false };
}

type MatchResult = { matches: false } | { matches: true; matchType: AstPrimitiveType };
export function nodeMatchesAstDefinitionTypes(
	node: Node,
	types: ReadonlyArray<AstPrimitiveType>,
): MatchResult {
	for (const typeName of types) {
		const result = nodeMatchAstDefinitionType(node, typeName);
		if (result.matches) {
			return result;
		}
	}

	return { matches: false };
}
