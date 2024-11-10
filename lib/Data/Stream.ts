// eslint-disable-next-line max-classes-per-file -- FIXME: Refactor into multiple files.
import { stringify } from "../functions/builtin-functions";
import type { ZrValue } from "./locals";
import type ZrUndefined from "./undefined";

export class ZrInputStream {
	constructor(private readonly input: ReadonlyArray<ZrUndefined | ZrValue>) {}

	public static empty(): ZrInputStream {
		return new ZrInputStream([]);
	}

	/**
	 * Whether or not this stream is empty.
	 *
	 * @returns If this is stream empty.
	 */
	public isEmpty(): boolean {
		return this.input.isEmpty();
	}

	/**
	 * Gets the input stream as a generator.
	 *
	 * ```ts
	 * for (const value of input.stream()) {
	 * 	print(value);
	 * }
	 * ```
	 */
	public *stream(): Generator<typeof ZrUndefined | ZrValue> {
		for (const value of this.input) {
			yield value;
		}
	}

	/**
	 * Returns an ipairs iterator.
	 *
	 * ```ts
	 * for (const [idx, value] of input.ipairs()) {
	 * 	print(idx, value);
	 * }
	 * ```
	 *
	 * @returns An ipairs iterator of the input stream.
	 */
	public ipairs(): IterableFunction<LuaTuple<[number, typeof ZrUndefined | ZrValue]>> {
		return ipairs(this.input);
	}

	/**
	 * Gets the input stream as an array.
	 *
	 * @returns The input stream as an array.
	 */
	public toArray(): ReadonlyArray<typeof ZrUndefined | ZrValue> {
		return this.input;
	}
}

export class ZrOutputStream {
	private readonly output = new Array<ZrUndefined | ZrValue>();

	/**
	 * Returns the output stream as an array.
	 *
	 * @returns The input stream as an array.
	 */
	public toArray(): ReadonlyArray<ZrUndefined | ZrValue> {
		return this.output;
	}

	/**
	 * Writes the specified message to the output stream.
	 *
	 * @param message - The message to write to the stream.
	 */
	public write(message: ZrUndefined | ZrValue): void {
		this.output.push(message);
	}

	/**
	 * Converts this output stream to an array of string values.
	 *
	 * @returns The output stream as a string array.
	 * @internal
	 */
	public _toStringArray(): Array<string> {
		return this.output.map(outputLog => stringify(outputLog));
	}

	/**
	 * Converts this output stream to an input stream.
	 *
	 * @returns This output stream as an input stream.
	 * @internal
	 */
	public _toInputStream(): ZrInputStream {
		return new ZrInputStream(this.output);
	}
}
