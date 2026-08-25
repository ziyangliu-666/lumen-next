/**
 * Two people sharing a server must never share a conversation.
 *
 * `LUMEN_BASIC_AUTH` now names more than one person, and the whole point of that change is
 * that a raw `?s=` key typed by one of them cannot land on another's `Conversation` or
 * directory. These tests check the two functions that carry that separation: which username
 * a request's header names, and what key results once it is known.
 */

import { describe, expect, it } from "vitest";
import { LOCAL_NAMESPACE, matchCredential, namespacedKey, parseCredentials } from "../src/auth.ts";

function basic(user: string, password: string): string {
	return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

describe("parseCredentials", () => {
	it("reads one credential per line", () => {
		const credentials = parseCredentials("alice:one\nbob:two");
		expect([...credentials.keys()]).toEqual(["alice", "bob"]);
	});

	it("is empty when LUMEN_BASIC_AUTH is unset", () => {
		expect(parseCredentials(undefined).size).toBe(0);
	});

	it("skips blank lines and lines with no colon", () => {
		const credentials = parseCredentials("alice:one\n\n   \nnotacredential\nbob:two");
		expect([...credentials.keys()]).toEqual(["alice", "bob"]);
	});

	it("keeps a colon that appears again inside the password", () => {
		// `indexOf`, not `split`: a password with its own colon must stay whole, or a
		// visitor who typed it correctly would still fail to match.
		const credentials = parseCredentials("alice:pass:word");
		expect([...credentials.keys()]).toEqual(["alice"]);
	});
});

describe("matchCredential", () => {
	const credentials = parseCredentials("alice:secret1\nbob:secret2");

	it("names the user whose password matches", () => {
		expect(matchCredential(basic("alice", "secret1"), credentials)).toBe("alice");
		expect(matchCredential(basic("bob", "secret2"), credentials)).toBe("bob");
	});

	it("refuses a wrong password", () => {
		expect(matchCredential(basic("alice", "wrong"), credentials)).toBeNull();
	});

	it("refuses one user's password offered under another user's name", () => {
		// The whole `user:password` line is hashed together, so alice's password does not
		// also authenticate as bob just because the digits happen to match.
		expect(matchCredential(basic("bob", "secret1"), credentials)).toBeNull();
	});

	it("refuses a header with no Basic scheme", () => {
		expect(matchCredential("", credentials)).toBeNull();
		expect(matchCredential("Bearer xyz", credentials)).toBeNull();
	});

	it("refuses a header that is not valid base64", () => {
		expect(matchCredential("Basic ???", credentials)).toBeNull();
	});
});

describe("namespacedKey", () => {
	it("keeps two users' identical raw keys apart", () => {
		expect(namespacedKey("alice", "shared")).not.toBe(namespacedKey("bob", "shared"));
	});

	it("keeps one user's two different raw keys apart", () => {
		expect(namespacedKey("alice", "one")).not.toBe(namespacedKey("alice", "two"));
	});

	it("does not let a raw key impersonate a different user", () => {
		// Nothing in a raw key can move the boundary between username and key, because the
		// username never comes from the raw key in the first place.
		expect(namespacedKey("al", "ice")).not.toBe(namespacedKey("alice", ""));
	});

	it("uses LOCAL_NAMESPACE as an ordinary username", () => {
		expect(namespacedKey(LOCAL_NAMESPACE, "x")).toBe("local::x");
	});
});
