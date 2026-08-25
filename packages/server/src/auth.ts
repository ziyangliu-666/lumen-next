/**
 * Who a request is, when `LUMEN_BASIC_AUTH` names more than one person.
 *
 * The rest of the server reads a request's conversation key off the query string alone. Two
 * people who guess the same key would then share one conversation and one directory on disk.
 * The fix has one job: turn a request into a username, so the caller can put that username
 * between the key and the filesystem.
 *
 * No I/O here. Every function takes what it needs as an argument and returns a value, so a
 * test can call them without a server, a socket, or a real password.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The namespace used when no username was authenticated: no `LUMEN_BASIC_AUTH` is set, so
 * the server runs as it always did, for one operator on one machine.
 */
export const LOCAL_NAMESPACE = "local";

/**
 * `LUMEN_BASIC_AUTH`, split into one `user:password` line per person.
 *
 * Lines, not commas. A password can hold a comma without anyone thinking twice about it, and
 * hardly anyone puts a raw newline inside one. A shell or an `.env` file that wants several
 * credentials can already write them on separate lines, with nothing to escape.
 *
 * Each credential is hashed whole, `user:password` together, not the password alone. A
 * request is checked the same way: decode its header to one `user:password` string, hash
 * that, and compare. So this map holds the hash, not the password, and the password is never
 * kept in memory as plain text past this one line.
 */
export function parseCredentials(raw: string | undefined): Map<string, Buffer> {
	const credentials = new Map<string, Buffer>();
	if (!raw) return credentials;
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const colon = trimmed.indexOf(":");
		if (colon <= 0) continue; // no colon, or an empty username: not a usable credential
		credentials.set(trimmed.slice(0, colon), createHash("sha256").update(trimmed).digest());
	}
	return credentials;
}

/**
 * The username behind a request's `Authorization` header, checked against every configured
 * credential, or `null` if none match.
 *
 * Compared with `timingSafeEqual`, not `===`: `===` returns at the first differing byte, so
 * how long a wrong guess takes says something about how much of it was right. Each header is
 * hashed before the comparison, so the two buffers `timingSafeEqual` sees are always the same
 * length, whatever the visitor typed.
 */
export function matchCredential(header: string, credentials: Map<string, Buffer>): string | null {
	const [scheme, encoded] = header.split(" ");
	if (scheme !== "Basic" || !encoded) return null;
	let given: string;
	try {
		given = Buffer.from(encoded, "base64").toString("utf8");
	} catch {
		return null;
	}
	const givenHash = createHash("sha256").update(given).digest();
	for (const [username, hash] of credentials) {
		if (timingSafeEqual(givenHash, hash)) return username;
	}
	return null;
}

/**
 * The key a conversation is stored and found under, once a username is known.
 *
 * Two people who type the same raw key at `?s=` must not land on the same `Conversation`
 * object. The username comes only from a configured credential or from `LOCAL_NAMESPACE`,
 * never from the raw key itself, so one visitor cannot choose a raw key that collides with
 * another visitor's username-plus-key pair.
 */
export function namespacedKey(username: string, rawKey: string): string {
	return `${username}::${rawKey}`;
}
