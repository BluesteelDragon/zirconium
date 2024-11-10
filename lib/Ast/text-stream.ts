/** A text stream. */
export default class ZrTextStream {
	private column = 0;
	private ptr = 1;
	private row = 0;

	constructor(private readonly source: string) {}

	/**
	 * Consume and return the next character in the stream.
	 *
	 * @param offset
	 */
	public next(offset = 1): string {
		const char = this.source.sub(this.ptr, this.ptr);
		this.ptr += offset;
		if (char === "\n") {
			this.column += 1;
		} else {
			this.column = 0;
			this.row += 1;
		}

		return char;
	}

	public getRowAndColumn(): [row: number, column: number] {
		return identity<[row: number, column: number]>([this.row, this.column]);
	}

	/**
	 * @param x
	 * @param y
	 * @internal
	 */
	public sub(x: number, y: number): string {
		return this.source.sub(x, y);
	}

	public getRow(): number {
		return this.row;
	}

	public getColumn(): number {
		return this.column;
	}

	/**
	 * Returns the next character in the stream without consuming it.
	 *
	 * @param offset
	 */
	public peek(offset = 0): string {
		return this.source.sub(this.ptr + offset, this.ptr + offset);
	}

	/** Resets the stream pointer to the beginning. */
	public reset(): void {
		this.ptr = 1;
	}

	/** Whether or not there's a next character in the stream. */
	public hasNext(): boolean {
		return this.source.size() >= this.ptr;
	}

	/** Get the current pointer location. */
	public getPtr(): number {
		return this.ptr;
	}

	/**
	 * @param ptr
	 * @internal
	 */
	public setPtr(ptr: number): void {
		this.ptr = ptr;
	}
}
