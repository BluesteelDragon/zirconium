import type { ZrValue } from "./locals";
import ZrUndefined from "./Undefined";

export function ZrIsUndefined(value: ZrUndefined | ZrValue): value is ZrUndefined {
	return value === ZrUndefined;
}
