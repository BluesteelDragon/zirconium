import type { ZrValue } from "./locals";

export default class ZrRange {
	private readonly rng = new Random();

	public static properties: Record<string, (range: ZrRange) => ZrValue> = {
		max: range => range.GetMax(),
		min: range => range.GetMin(),
		random: range => range.GetRandomNumber(),
		random_int: range => range.GetRandomInteger(),
	};

	constructor(private readonly range: NumberRange) {}
	public GetValue(): NumberRange {
		return this.range;
	}

	public GetRandomInteger(): number {
		return this.rng.NextInteger(this.range.Min, this.range.Max);
	}

	public GetRandomNumber(): number {
		return this.rng.NextNumber(this.range.Min, this.range.Max);
	}

	public *Iterator(): Generator<number> {
		for (let index = this.range.Min; index <= this.range.Max; index++) {
			yield index;
		}
	}

	public GetMin(): number {
		return this.range.Min;
	}

	public GetMax(): number {
		return this.range.Max;
	}

	public toString(): string {
		return `${this.range.Min} .. ${this.range.Max}`;
	}
}
