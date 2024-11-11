import type ZrRuntime from "../runtime/runtime";
import type ZrLocalStack from "./locals";
import { ZrInputStream, ZrOutputStream } from "./stream";

export default class ZrContext {
	private input = ZrInputStream.empty();
	private output = new ZrOutputStream();

	constructor(private readonly runtime: ZrRuntime) {}

	public static createPipedContext(
		runtime: ZrRuntime,
		input: ZrInputStream,
		output: ZrOutputStream,
	): ZrContext {
		const context = new ZrContext(runtime);
		context.input = input;
		context.output = output;
		return context;
	}

	/**
	 * Get the locals registered to this context.
	 *
	 * @returns A stack containing the locals registered to the context.
	 * @internal
	 */
	public getLocals(): ZrLocalStack {
		return this.runtime.getLocals();
	}

	/**
	 * Gets the input stream.
	 *
	 * @returns The input stream.
	 */
	public getInput(): ZrInputStream {
		return this.input;
	}

	public getExecutor(): Player | undefined {
		return this.runtime.getExecutingPlayer();
	}

	/**
	 * Gets the output stream.
	 *
	 * @returns The output stream.
	 */
	public getOutput(): ZrOutputStream {
		return this.output;
	}
}
