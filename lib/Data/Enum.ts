import { ZrEnumItem } from "./enum-item";

/** The built-in Enum type in Zirconium. */
export class ZrEnum {
	private readonly items = new Array<ZrEnumItem>();

	/**
	 * Creates a ZrEnum.
	 *
	 * @param items - The item labels.
	 * @param name - The name of this enum object.
	 * @param enumFactory - A custom enum item factory.
	 */
	protected constructor(
		items: ReadonlyArray<string>,
		private readonly name = "[ZrEnum]",
		/**
		 * Mainly for Zircon to override with a child enum type.
		 *
		 * @param value - Enum value.
		 * @param index - Enum index.
		 * @returns A new ZrEnum.
		 */
		enumFactory: (value: string, index: number) => ZrEnumItem = (value, index) => {
			return new ZrEnumItem(this, index, value);
		},
	) {
		this.items = items.map(enumFactory);
	}

	/**
	 * Creates an enum from an array of strings - where the strings will be the
	 * values of the enum.
	 *
	 * @param name - The name of the enum object.
	 * @param items - The items in this enum.
	 * @returns The enum object.
	 */
	public static fromArray(name: string, items: Array<string>): ZrEnum {
		return new ZrEnum(items, name);
	}

	public getEnumName(): string {
		return this.name;
	}

	public getItemByName(name: string): undefined | ZrEnumItem {
		return this.items.find(item => item.getName() === name);
	}

	public getItemByIndex(index: number): undefined | ZrEnumItem {
		return this.items.find(item => item.getValue() === index);
	}

	public getItems(): ReadonlyArray<ZrEnumItem> {
		return this.items as ReadonlyArray<ZrEnumItem>;
	}

	public toString(): string {
		return `enum@${this.name}`;
	}
}
