import type { ZrEnum } from "./enum";

/** The built-in Zirconium enum item type. */
export class ZrEnumItem {
	constructor(
		private readonly parentEnum: ZrEnum,
		private readonly value: number,
		private readonly name: string,
	) {}

	public getEnum(): ZrEnum {
		return this.parentEnum;
	}

	public getValue(): number {
		return this.value;
	}

	public getName(): string {
		return this.name;
	}

	public toString(): string {
		return `enum@${this.parentEnum.getEnumName()}.${this.getName()}`;
	}
}
