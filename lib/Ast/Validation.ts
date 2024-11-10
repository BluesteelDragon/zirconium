import type { NodeError } from "./nodes/node-types";

interface ValidationSuccess {
	success: true;
}
interface ValidationFailure {
	errorNodes: Array<NodeError>;
	success: false;
}
export type ValidationResult = ValidationFailure | ValidationSuccess;
