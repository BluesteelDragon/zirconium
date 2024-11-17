import { ZrNodeKind } from "./enum";
import type {
	ArrayIndexExpression,
	BooleanLiteral,
	Identifier,
	Node,
	NodeTypes,
	ParentNode,
	PropertyAccessExpression,
} from "./node-types";

export function getKindName(kind: undefined | ZrNodeKind): string {
	if (kind === undefined) {
		return "<none>";
	}

	return ZrNodeKind[kind];
}

function isNode<K extends keyof NodeTypes>(node: Node, kind: K): node is NodeTypes[K] {
	return node.kind === kind;
}

function interpolate(node: ArrayIndexExpression | Identifier | PropertyAccessExpression): string {
	if (isNode(node, ZrNodeKind.Identifier)) {
		return node.name;
	} else if (isNode(node, ZrNodeKind.PropertyAccessExpression)) {
		return node.name + "." + interpolate(node.expression);
	} else if (isNode(node, ZrNodeKind.ArrayIndexExpression)) {
		return interpolate(node.expression) + "." + node.index.value;
	}

	throw `Invalid`;
}

export function getVariableName(
	node: ArrayIndexExpression | Identifier | PropertyAccessExpression,
): string {
	return interpolate(node);
}

export function getFriendlyName(node: Node, isConst = false): boolean | string {
	switch (node.kind) {
		case ZrNodeKind.String:
		case ZrNodeKind.InterpolatedString: {
			return "string";
		}
		case ZrNodeKind.Number: {
			return "number";
		}
		case ZrNodeKind.Boolean: {
			return isConst ? (node as BooleanLiteral).value : "boolean";
		}
		default: {
			return getKindName(node.kind);
		}
	}
}

export function getNodeKindName(node: Node): string {
	if (node === undefined) {
		return "<none>";
	}

	return getKindName(node.kind);
}

export function isParentNode(node: Node): node is ParentNode {
	return "children" in node;
}

// export function getNextNode(node: Node): Node | undefined {
// 	const { parent } = node;
// 	if (parent && isParentNode(parent)) {
// 		const index = parent.children.indexOf(node) + 1;
// 		return parent.children[index];
// 	}
// }

// export function getPreviousNode(node: Node): Node | undefined {
// 	const { parent } = node;
// 	if (parent && isParentNode(parent)) {
// 		const index = parent.children.indexOf(node) - 1;
// 		return parent.children[index];
// 	}
// }
