import { CmdSyntaxKind } from "../nodes";
import { ZrNodeFlag } from "../nodes/enum";
import { getNodeKindName } from "../nodes/functions";
import { isNode } from "../nodes/guards";
import type { Node } from "../nodes/node-types";

// eslint-disable-next-line max-lines-per-function, sonar/cognitive-complexity -- FIXME: Refactor me pls.
function prettyPrintNodes(nodes: Array<Node>, prefix = "", verbose = false): void {
	for (const node of nodes) {
		if (isNode(node, CmdSyntaxKind.String)) {
			const str =
				node.quotes !== undefined
					? `${node.quotes}${node.text}${node.quotes}`
					: `\`${node.text}\``;
			if (verbose) {
				print(
					prefix,
					getNodeKindName(node),
					str,
					`[${node.startPos}:${node.endPos}]`,
					`{${node.rawText}}`,
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], str);
			}

			if (node.isUnterminated ?? false) {
				print(prefix, "Unterminated String");
			}
		} else if (
			isNode(node, CmdSyntaxKind.CallExpression) ||
			isNode(node, CmdSyntaxKind.SimpleCallExpression)
		) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
					"{",
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes([node.expression], prefix + "\t", verbose);
			prettyPrintNodes(node.arguments, prefix + "\t", verbose);
			if (isNode(node, CmdSyntaxKind.CallExpression)) {
				prettyPrintNodes(node.options, prefix + "\t", verbose);
			}

			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.Number) || isNode(node, CmdSyntaxKind.Boolean)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.value,
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.value);
			}
		} else if (isNode(node, CmdSyntaxKind.OptionKey)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.flag,
					`[${node.startPos ?? 0}:${node.endPos ?? 0}]`,
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.flag);
			}

			prettyPrintNodes([node.right!], prefix + "\t", verbose);
		} else if (isNode(node, CmdSyntaxKind.Identifier)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.name,
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.name);
			}
		} else if (isNode(node, CmdSyntaxKind.OperatorToken)) {
			print(prefix, CmdSyntaxKind[node.kind], node.operator);
		} else if (isNode(node, CmdSyntaxKind.UnaryExpression)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.operator,
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
					"{",
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.operator, "{");
			}

			prettyPrintNodes([node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.BinaryExpression)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					node.operator,
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
					"{",
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], node.operator, "{");
			}

			prettyPrintNodes([node.left, node.right], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.InterpolatedString)) {
			if (verbose) {
				print(
					prefix,
					CmdSyntaxKind[node.kind],
					`'${node.rawText}'`,
					`[${node.startPos}:${node.endPos}]`,
					"{",
				);
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes(node.values, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.Source)) {
			if (verbose) {
				print(prefix, CmdSyntaxKind[node.kind], `[${node.startPos}:${node.endPos}]`, "{");
			} else {
				print(prefix, CmdSyntaxKind[node.kind], "{");
			}

			prettyPrintNodes(node.children, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.PrefixToken)) {
			print(prefix, CmdSyntaxKind[node.kind], node.value);
		} else if (isNode(node, CmdSyntaxKind.PrefixExpression)) {
			print(prefix, CmdSyntaxKind[node.kind], "{");
			prettyPrintNodes([node.prefix, node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.VariableDeclaration)) {
			const isConst =
				(node.flags & ZrNodeFlag.Const) !== 0
					? "const"
					: (node.flags & ZrNodeFlag.Let) !== 0
						? "let"
						: "var";
			print(prefix, CmdSyntaxKind[node.kind], isConst, "{");

			prettyPrintNodes([node.identifier, node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.VariableStatement)) {
			print(prefix, CmdSyntaxKind[node.kind], "{");
			if (node.modifiers) {
				prettyPrintNodes(node.modifiers, prefix + "\t", verbose);
			}

			prettyPrintNodes([node.declaration], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.EndOfStatement)) {
			print(prefix, "EndOfStatement");
		} else if (isNode(node, CmdSyntaxKind.Invalid)) {
			print(prefix, "SYNTAX ERROR", node.message);
		} else if (isNode(node, CmdSyntaxKind.OptionExpression)) {
			if (verbose) {
				print(
					prefix,
					"OptionExpression",
					`[${node.startPos ?? 0}:${node.endPos ?? 0}]`,
					"{",
				);
			} else {
				print(prefix, "OptionExpression", "{");
			}

			prettyPrintNodes([node.option, node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.ExpressionStatement)) {
			print(prefix, "ExpressionStatement", "{");
			prettyPrintNodes([node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.ArrayLiteralExpression)) {
			print(prefix, "ArrayLiteralExpression", "{");
			prettyPrintNodes(node.values, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.PropertyAccessExpression)) {
			print(prefix, "PropertyAccessExpression", "{");
			prettyPrintNodes([node.expression, node.name], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.ArrayIndexExpression)) {
			print(prefix, "ArrayIndexExpression", "{");
			prettyPrintNodes([node.expression, node.index], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.PropertyAssignment)) {
			print(prefix, "PropertyAssignment", "{");
			prettyPrintNodes([node.name, node.initializer], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.ObjectLiteralExpression)) {
			print(prefix, "ObjectLiteralExpression", "{");
			prettyPrintNodes(node.values, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.Block)) {
			print(prefix, "Block", "{");
			prettyPrintNodes(node.statements, prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.FunctionDeclaration)) {
			print(prefix, "FunctionDeclaration", "{");
			prettyPrintNodes([node.name], prefix + "\t", verbose);
			prettyPrintNodes(node.parameters, prefix + "\t ", verbose);
			prettyPrintNodes([node.body], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.FunctionExpression)) {
			print(prefix, "FunctionExpression", "{");
			prettyPrintNodes(node.parameters, prefix + "\t ", verbose);
			prettyPrintNodes([node.body], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.Parameter)) {
			print(prefix, "Parameter", "{");
			prettyPrintNodes([node.name], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.TypeReference)) {
			print(prefix, "TypeReference", "{");
			prettyPrintNodes([node.typeName], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.ParenthesizedExpression)) {
			print(prefix, "ParenthesizedExpression", "{");
			prettyPrintNodes([node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.ForInStatement)) {
			print(prefix, "ForInStatement", "{");
			prettyPrintNodes(
				[node.initializer, node.expression, node.statement],
				prefix + "\t",
				verbose,
			);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.ReturnStatement)) {
			print(prefix, "ReturnStatement", "{");
			prettyPrintNodes([node.expression], prefix + "\t", verbose);
			print(prefix, "}");
		} else if (isNode(node, CmdSyntaxKind.IfStatement)) {
			print(prefix, "IfStatement", "{");
			if (node.condition) {
				prettyPrintNodes([node.condition], prefix + "\t", verbose);
			}

			if (node.thenStatement) {
				prettyPrintNodes([node.thenStatement], prefix + "\t", verbose);
			}

			if (node.elseStatement) {
				prettyPrintNodes([node.elseStatement], prefix + "\t", verbose);
			}

			print(prefix, "}");
		} else {
			print(prefix, getNodeKindName(node));
		}
	}
}

export = prettyPrintNodes;
