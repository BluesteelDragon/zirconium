import { describe, expect, it } from "@rbxts/jest-globals";

import { ZrInstanceUserdata } from "../data/userdata";

describe("ZrInstanceUserdata", () => {
	it("should be constructable", () => {
		expect(new ZrInstanceUserdata(game.Workspace)).toBeInstanceOf(ZrInstanceUserdata);
	});
});

export = true;
