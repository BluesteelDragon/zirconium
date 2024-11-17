import { ZrIsUndefined } from "./helpers";
import type { ZrValue } from "./locals";
import ZrUndefined from "./undefined";

/** A zirconium object. */
export default class ZrObject {
	private readonly map = new Map<string, ZrValue>();

	public static fromRecord(record: Record<string, ZrValue>): ZrObject {
		const object = new ZrObject();
		for (const [key, value] of pairs(record)) {
			object.set(key, value);
		}

		return object;
	}

	public set(name: string, value: ZrUndefined | ZrValue): void {
		if (ZrIsUndefined(value)) {
			this.map.delete(name);
		} else {
			this.map.set(name, value);
		}
	}

	public get(name: string): typeof ZrUndefined | ZrValue {
		return this.map.get(name) ?? ZrUndefined;
	}

	public toString(): string {
		const str = new Array<string>();
		for (const [key, value] of this.map) {
			str.push(`${key}: ${value}`);
		}

		return `{${str.join(", ") || " "}}`;
	}

	public toMap(): ReadonlyMap<string, Exclude<ZrValue, ZrUndefined>> {
		return this.map as ReadonlyMap<string, Exclude<ZrValue, ZrUndefined>>;
	}
}
