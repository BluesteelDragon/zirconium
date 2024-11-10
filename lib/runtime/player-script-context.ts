import type { SourceFile } from "Ast/nodes/node-types";
import { ZrInstanceUserdata } from "data/userdata";

import ZrScript from "./script";
import ZrScriptContext from "./script-context";

export default class ZrPlayerScriptContext extends ZrScriptContext {
	constructor(private readonly player: Player) {
		super();
	}

	public createScript(nodes: SourceFile): ZrScript {
		this.registerGlobal("executor", new ZrInstanceUserdata(this.player));
		return new ZrScript(nodes, this.getGlobals(), this.player);
	}
}
