# -*- coding: utf-8 -*-
"""Every figure in docs/luyi/design.docx — UC1 Identity, LU YI.

Figure 1  Module structure of UC1 inside the monolith
Figure 2  Analysis class diagram — UC1 Identity
Figure 3  Analysis sequence diagram — sign in with email and password
Figure 4  Analysis sequence diagram — sign in with an OAuth provider
Figure 5  Design class diagram — Strategy with Template Method
Figure 6  Design sequence diagram — password login
Figure 7  Design sequence diagram — GitHub OAuth login

Run `python gen_diagrams.py` to regenerate all seven as .png (240 dpi, the
version embedded in the document) and .svg (vector, for zooming).

Notation: `03a AM.pdf` for the analysis model, `04a DM.pdf` for the design
model. Analysis figures carry the three analysis stereotypes and show
attributes on «entity» classes only; design figures drop the stereotypes
except «interface», and carry parameter and return types.
"""
import os
from umlkit import SD, CD, text_w

HERE = os.path.dirname(os.path.abspath(__file__))
out = lambda n: os.path.join(HERE, n)

A_SUB = ("Lumen — UC1 Identity, analysis model. Stereotypes «boundary» / «control» / "
         "«entity» per 03a AM.pdf;\nattributes are shown for «entity» classes only.")
D_SUB = ("Lumen — UC1 Identity, design model. Design problem: four ways to become "
         "authenticated must end in one\nsession, and a fifth must not change the session "
         "code. Pattern: Strategy with Template Method.")

S = 0.62  # inches per data unit; must match CD_SCALE in umlkit


def mk(cd, key, cx, y_top, kind, name, attrs=(), methods=(), abstract=False):
    """A class box centred on cx, wide enough for its widest line."""
    body = list(attrs) + list(methods)
    w = max(text_w(name, 10.4, True, S),
            max([text_w(t, 8.6, False, S) for t in body], default=0.0) + 0.32,
            text_w("<<" + kind + ">>", 8.4, False, S) + 0.30 if kind else 0.0,
            2.4) + 0.75
    return cd.box(key, cx - w / 2, y_top, w, kind, name, attrs, methods, abstract)


def centre(b, cy):
    b.y_top, b.y_bot = cy + b.h / 2, cy - b.h / 2
    return b


R = lambda b, y: (b.x + b.w, y)
L = lambda b, y: (b.x, y)
T = lambda b, x=None: ((b.x + b.w / 2) if x is None else x, b.y_top)
B = lambda b, x=None: ((b.x + b.w / 2) if x is None else x, b.y_bot)
CY = lambda b: (b.y_top + b.y_bot) / 2

# ========================================== Figure 1 : module structure
cd = CD()
WX, MX, CX = 2.6, 2.6, 2.6

signin = mk(cd, "signin", -2.2, 13.0, "boundary", "02 Sign in / sign up")
acct = mk(cd, "acct", 3.6, 13.0, "boundary", "05 Settings: Account")

ident = mk(cd, "ident", -2.4, 9.4, "module", "identity", (), [
    "AbstractAuthFlow, AuthStrategy × 4",
    "AccountRepo, verifySessionCookie"])
email = mk(cd, "email", 4.6, 9.4, "module", "email", (), [
    "password-reset link",
    "address-verification message"])

core = mk(cd, "core", 0.6, 5.2, "module", "core", (), [
    "http (authGuard, HttpError), db, domain",
    "frozen after Sprint 1 — owner ZIYANG"])
db = mk(cd, "db", 0.6, 1.8, "entity", "Postgres", [
    "accounts", "credentials", "auth_sessions"])

cd.actor(-2.2, signin.y_top + 2.4, "User / Staff")
cd.link([(-2.2, signin.y_top + 1.05), T(signin)])
cd.link([B(signin), T(ident)], kind="dep", label="HTTP (§7)")
cd.link([B(acct), T(ident, ident.x + ident.w - 0.9)], kind="dep")
cd.link([R(ident, CY(ident)), L(email, CY(email))], kind="dep")
cd.link([B(ident, ident.x + 1.4), (ident.x + 1.4, core.y_top + 0.9),
         T(core, core.x + 1.2)], kind="dep")
cd.link([B(email, email.x + 1.0), (email.x + 1.0, core.y_top + 0.9),
         T(core, core.x + core.w - 1.2)], kind="dep")
cd.link([B(core), T(db)], kind="dep")

cd.notes.append((core.x + core.w + 0.6, core.y_top,
                 "Both modules live inside apps/server/src/modules/identity/.\n"
                 "ARCHITECTURE.md §2 lists identity's inner modules as\n"
                 "\"identity, email\", so email is not a sibling slice and has\n"
                 "no separate owner. Each module may import core; core imports\n"
                 "neither. Nothing outside the slice reaches past index.ts."))
cd.draw("Figure 1 — Module structure of UC1 inside the monolith",
        "Lumen — one process, one Postgres database, modules calling each other in-process.",
        out("fig1-module-structure"))
print("1/7 module structure")

# =============================== Figure 2 : analysis class diagram, UC1
cd = CD()
AX, CX2 = 2.4, 13.2

signin = mk(cd, "signin", AX, 15.4, "boundary", "SignInPage", (), [
    "+ submitPassword(email, password)", "+ startOAuth(provider)",
    "+ displayError(message)", "+ redirectByRole(principal)"])
settings = mk(cd, "settings", CX2, 15.4, "boundary", "AccountSettingsPage", (), [
    "+ viewAccount()", "+ updateAccount(fields)",
    "+ changePassword(current, next)", "+ displayError(message)"])
ctrl = mk(cd, "ctrl", (AX + CX2) / 2, 11.0, "control", "AuthenticationController", (), [
    "+ signUp(email, password, name)", "+ signIn(credentials)",
    "+ resolveSession(token)", "+ updateAccount(accountId, fields)",
    "+ changePassword(accountId, current, next)"])

acc = mk(cd, "acc", AX - 0.6, 6.0, "entity", "Account", [
    "- id", "- email", "- displayName", "- role"], [
    "+ create()", "+ findByEmail()", "+ findOrCreateByExternalId()",
    "+ update()", "+ getRole()"])
cred = mk(cd, "cred", 8.2, 6.0, "entity", "Credential", [
    "- kind", "- secret"], [
    "+ create()", "+ find()", "+ matches()", "+ replaceSecret()"])
sess = mk(cd, "sess", 15.4, 6.0, "entity", "LoginSession", [
    "- token", "- expiresAt"], [
    "+ create()", "+ find()", "+ isExpired()", "+ revoke()"])

prov = centre(mk(cd, "prov", CX2 + 7.0, 0, "boundary", "OAuthProviderInterface", (), [
    "+ exchangeCodeForToken(code)", "+ fetchVerifiedEmail(token)"]), CY(ctrl))

ya = signin.y_top + 2.6
cd.actor((AX + CX2) / 2, ya, "Account Holder")
cd.actor((AX + CX2) / 2 - 6.2, ya + 3.2, "User")
cd.actor((AX + CX2) / 2 + 6.2, ya + 3.2, "Staff Member")
cd.link([((AX + CX2) / 2 - 6.2, ya + 3.2 - 1.40), ((AX + CX2) / 2 - 0.60, ya + 0.12)],
        kind="inherit")
cd.link([((AX + CX2) / 2 + 6.2, ya + 3.2 - 1.40), ((AX + CX2) / 2 + 0.60, ya + 0.12)],
        kind="inherit")
cd.link([((AX + CX2) / 2, ya - 1.40), (AX, signin.y_top)])
cd.link([((AX + CX2) / 2, ya - 1.40), (CX2, settings.y_top)])

cd.link([B(signin), T(ctrl, ctrl.x + 1.6)], ma="1", mb="1")
cd.link([B(settings), T(ctrl, ctrl.x + ctrl.w - 1.6)], ma="1", mb="1")
cd.link([B(ctrl, ctrl.x + 1.4), (ctrl.x + 1.4, acc.y_top + 1.0), T(acc)],
        kind="dep")
cd.link([B(ctrl, ctrl.x + ctrl.w / 2), T(cred)], kind="dep")
cd.link([B(ctrl, ctrl.x + ctrl.w - 1.4), (ctrl.x + ctrl.w - 1.4, sess.y_top + 1.0),
         T(sess)], kind="dep")
cd.link([R(ctrl, CY(ctrl)), L(prov, CY(prov))], kind="dep")

cd.link([R(acc, acc.y_top - 1.5), L(cred, cred.y_top - 1.5)], ma="1", mb="0..*")
cd.link([B(acc, acc.x + 1.0), (acc.x + 1.0, acc.y_bot - 1.5),
         (sess.x + 1.0, acc.y_bot - 1.5), B(sess, sess.x + 1.0)], ma="1", mb="0..*")

cd.notes.append((AX - 3.4, min(acc.y_bot, cred.y_bot, sess.y_bot) - 2.4,
                 "User and Staff Member both inherit Account Holder: SLICES.md's review note fixes that there is no\n"
                 "separate hidden admin login — a staff account signs in through the same page and the same flow, and\n"
                 "only the post-authentication redirect differs. The association is therefore held once by the abstract actor.\n"
                 "LoginSession is named in full, not \"Session\": core/db/schema.sql already has a sessions table meaning an\n"
                 "agent session (UC3), a different concept. OAuthProviderInterface is «boundary», not «entity» — 03a AM.pdf\n"
                 "p.10, a boundary object also covers communication with other systems."))
cd.draw("Figure 2 — Analysis class diagram: UC1 Identity", A_SUB,
        out("fig2-analysis-class"))
print("2/7 analysis class diagram")

# ================== Figure 3 : analysis sequence diagram, password sign-in
sd = SD([
    dict(key="user", kind="actor",    name="User"),
    dict(key="page", kind="boundary", name="SignInPage"),
    dict(key="ctrl", kind="control",  name="Authentication\nController"),
    dict(key="cred", kind="entity",   name="Credential"),
    dict(key="acc",  kind="entity",   name="Account"),
    dict(key="sess", kind="entity",   name="LoginSession"),
])
sd.msg("user", "page", "1: submitPassword(email, password)")
sd.selfmsg("page", "2: validateDataFormat()")
sd.msg("page", "ctrl", "3: signIn(email, password)")
sd.msg("ctrl", "cred", "4: find(email, \"password\")")
sd.ret("cred", "ctrl", "5: credential")

f = sd.frag("alt", "[no credential, or secret does not match]", ("page", "sess"))
sd.msg("ctrl", "page", "6: displayError(\"Invalid email or password\")")
sd.frag_else(f, "[secret matches]")
sd.msg("ctrl", "cred", "7: matches(password)")
sd.ret("cred", "ctrl", "8: true")
sd.msg("ctrl", "acc", "9: findByEmail(email)")
sd.ret("acc", "ctrl", "10: account")
sd.msg("ctrl", "sess", "11: «create» create(account)")
sd.ret("sess", "ctrl", "12: token")
sd.msg("ctrl", "page", "13: redirectByRole(principal)")
sd.frag_end(f)
sd.msg("page", "user", "14: display Home or Admin")
sd.draw("Figure 3 — Analysis sequence diagram: sign in with email and password",
        A_SUB + "\nOne code for both failure branches: the response must not distinguish "
                "\"no such account\" from \"wrong password\".",
        out("fig3-analysis-sd-password"))
print("3/7 analysis sequence diagram (password)")

# ===================== Figure 4 : analysis sequence diagram, OAuth sign-in
sd = SD([
    dict(key="user", kind="actor",    name="User"),
    dict(key="page", kind="boundary", name="SignInPage"),
    dict(key="ctrl", kind="control",  name="Authentication\nController"),
    dict(key="prov", kind="boundary", name="OAuthProvider\nInterface"),
    dict(key="acc",  kind="entity",   name="Account"),
    dict(key="sess", kind="entity",   name="LoginSession"),
])
sd.msg("user", "page", "1: startOAuth(\"github\")")
sd.msg("page", "ctrl", "2: beginOAuth(\"github\")")
sd.ret("ctrl", "page", "3: consentUrl")
sd.msg("page", "user", "4: redirect to the provider's consent screen")
sd.msg("user", "page", "5: callback(code)")
sd.msg("page", "ctrl", "6: signIn(\"github\", code)")
sd.msg("ctrl", "prov", "7: exchangeCodeForToken(code)")
sd.ret("prov", "ctrl", "8: accessToken")
sd.msg("ctrl", "prov", "9: fetchVerifiedEmail(accessToken)")
sd.ret("prov", "ctrl", "10: verifiedEmail")

f = sd.frag("alt", "[exchange rejected, or no verified email]", ("page", "sess"))
sd.msg("ctrl", "page", "11: displayError(\"oauth_failed\")")
sd.frag_else(f, "[verified email returned]")
sd.msg("ctrl", "acc", "12: findOrCreateByExternalId(\"github\", verifiedEmail)")
sd.ret("acc", "ctrl", "13: account")
sd.msg("ctrl", "sess", "14: «create» create(account)")
sd.ret("sess", "ctrl", "15: token")
sd.msg("ctrl", "page", "16: redirectByRole(principal)")
sd.frag_end(f)
sd.msg("page", "user", "17: display Home or Admin")
sd.draw("Figure 4 — Analysis sequence diagram: sign in with an OAuth provider",
        A_SUB + "\nMessages 11 onwards are identical to Figure 3 from message 11: the two "
                "flows differ only in how the\nemail is verified, and converge on one "
                "LoginSession. That convergence is the design problem of §4.",
        out("fig4-analysis-sd-oauth"))
print("4/7 analysis sequence diagram (OAuth)")

# ================================= Figure 5 : design class diagram
# Laid out two strategies per row rather than four in a line: one row of four is
# three times wider than tall and shrinks to nothing at page width.
cd = CD()
IX, FX = 3.4, 17.0

strat = mk(cd, "strat", IX, 17.6, "interface", "AuthStrategy", (), [
    "+ kind : AuthKind",
    "+ verify(payload : Credentials) : Promise<Principal | null>"])
flow = mk(cd, "flow", FX, 17.6, "", "AbstractAuthFlow", (), [
    "# strategies() : AuthStrategy[]",
    "+ authenticate(creds : Credentials) : Promise<Principal | null>",
    "# onAuthenticated(principal : Principal) : Promise<Principal>"], abstract=True)
prod = mk(cd, "prod", FX, 13.4, "", "ProductionAuthFlow", (), [
    "# strategies() : AuthStrategy[]",
    "# onAuthenticated(principal : Principal) : Promise<Principal>"])

LX, RX = 0.0, 12.4
row1, row2 = 9.6, 5.0
pwd = mk(cd, "pwd", LX, row1, "", "PasswordStrategy", (), [
    "+ kind = \"password\"",
    "+ verify(payload) : Promise<Principal | null>",
    "- scryptCompare(plain : string, hash : string) : boolean"])
ses = mk(cd, "ses", RX, row1, "", "SessionStrategy", (), [
    "+ kind = \"session\"",
    "+ verify(payload) : Promise<Principal | null>",
    "+ verifySessionCookie(token : string) : Promise<Principal | null>"])
gh = mk(cd, "gh", LX, row2, "", "GithubStrategy", (), [
    "+ kind = \"github\"",
    "+ verify(payload) : Promise<Principal | null>",
    "- exchangeCode(code : string) : Promise<string>",
    "- fetchVerifiedEmail(token : string) : Promise<string>"])
gg = mk(cd, "gg", RX, row2, "", "GoogleStrategy", (), [
    "+ kind = \"google\"",
    "+ verify(payload) : Promise<Principal | null>",
    "- exchangeCode(code : string) : Promise<string>",
    "- fetchVerifiedEmail(token : string) : Promise<string>"])

repo = mk(cd, "repo", (LX + RX) / 2, min(gh.y_bot, gg.y_bot) - 2.6, "", "AccountRepo", (), [
    "+ findCredential(email : string, kind : AuthKind) : Promise<Credential | null>",
    "+ findOrCreateByExternalId(provider : string, id : string, email : string) : Promise<Account>",
    "+ createAuthSession(accountId : string) : Promise<string>",
    "+ findAuthSession(token : string) : Promise<Principal | null>",
    "+ getAccount(accountId : string) : Promise<Account>",
    "+ updateAccount(accountId : string, fields : AccountPatch) : Promise<Account>"])

# realisation: one dashed line with a hollow triangle into AuthStrategy, fanning
# out through a shared bar to the top row, and down the sides to the second row
bar = row1 + 1.9
cd.link([(pwd.x + pwd.w / 2, bar), (ses.x + ses.w / 2, bar)])
cd.link([T(pwd), (pwd.x + pwd.w / 2, bar)])
cd.link([T(ses), (ses.x + ses.w / 2, bar)])
cd.link([(strat.x + strat.w / 2, bar), B(strat)], kind="realise")
for top, bottom in ((pwd, gh), (ses, gg)):
    cd.link([T(bottom, bottom.x + 0.9), (bottom.x + 0.9, top.y_bot)])

# template method holds a collection of strategies
cd.link([R(strat, CY(strat)), L(flow, CY(strat))], kind="aggr", ma="1", mb="1..*",
        label="strategies()")
cd.link([B(flow), T(prod)], kind="inherit")

# everything that reads or writes the database goes through the one repository,
# so all five dependencies are routed orthogonally into AccountRepo
cd.link([B(gh, gh.x + gh.w - 1.4), (gh.x + gh.w - 1.4, repo.y_top)], kind="dep")
cd.link([B(gg, gg.x + 1.4), (gg.x + 1.4, repo.y_top + 1.3),
         (repo.x + repo.w - 1.4, repo.y_top + 1.3),
         T(repo, repo.x + repo.w - 1.4)], kind="dep")
cd.link([L(pwd, CY(pwd)), (pwd.x - 2.4, CY(pwd)), (pwd.x - 2.4, CY(repo) + 0.9),
         L(repo, CY(repo) + 0.9)], kind="dep")
cd.link([R(ses, CY(ses)), (ses.x + ses.w + 2.4, CY(ses)),
         (ses.x + ses.w + 2.4, CY(repo) + 0.9), R(repo, CY(repo) + 0.9)], kind="dep")
cd.link([B(prod, prod.x + prod.w - 1.6), (prod.x + prod.w - 1.6, CY(repo) - 1.1),
         R(repo, CY(repo) - 1.1)], kind="dep")

cd.notes.append((repo.x - 1.0, repo.y_bot - 1.4,
                 "authenticate() is the template method and is written once: find the strategy whose kind matches,\n"
                 "call verify(), then call onAuthenticated(). Only verify() varies, so \"always issue exactly one\n"
                 "session\" runs from a single place and cannot be forgotten per branch. A fifth way in is one new\n"
                 "class realising AuthStrategy, registered in strategies(); authenticate() itself does not change.\n"
                 "AccountRepo is the only class in the slice that touches accounts, credentials and auth_sessions."))
cd.draw("Figure 5 — Design class diagram: Strategy with Template Method", D_SUB,
        out("fig5-design-class"))
print("5/7 design class diagram")

# ============================ Figure 6 : design sequence diagram, password
sd = SD([
    dict(key="page", kind="boundary", name="SignInPage"),
    dict(key="flow", kind="",         name="ProductionAuthFlow"),
    dict(key="pwd",  kind="",         name="PasswordStrategy"),
    dict(key="repo", kind="",         name="AccountRepo"),
    dict(key="db",   kind="entity",   name="Postgres"),
])
sd.msg("page", "flow", "1: authenticate({ kind: \"password\", payload })")
sd.selfmsg("flow", "2: strategies().find(s => s.kind === payload.kind)")
sd.msg("flow", "pwd", "3: verify(payload)")
sd.msg("pwd", "repo", "4: findCredential(payload.email, \"password\")")
sd.msg("repo", "db", "5: select from credentials")
sd.ret("db", "repo", "6: credential row")
sd.ret("repo", "pwd", "7: credential")
sd.selfmsg("pwd", "8: scryptCompare(payload.password, credential.hash)")

f = sd.frag("alt", "[no credential, or compare fails]", ("page", "db"))
sd.ret("pwd", "flow", "9: null")
sd.ret("flow", "page", "10: null  →  401 invalid_credentials")
sd.frag_else(f, "[compare succeeds]")
sd.ret("pwd", "flow", "11: principal")
sd.selfmsg("flow", "12: onAuthenticated(principal)")
sd.msg("flow", "repo", "13: createAuthSession(principal.accountId)")
sd.msg("repo", "db", "14: insert into auth_sessions")
sd.ret("db", "repo", "15: token")
sd.ret("repo", "flow", "16: token")
sd.ret("flow", "page", "17: principal  +  Set-Cookie: lumen_session")
sd.frag_end(f)
sd.draw("Figure 6 — Design sequence diagram: password login", D_SUB,
        out("fig6-design-sd-password"))
print("6/7 design sequence diagram (password)")

# =============================== Figure 7 : design sequence diagram, OAuth
sd = SD([
    dict(key="page", kind="boundary", name="SignInPage"),
    dict(key="flow", kind="",         name="ProductionAuthFlow"),
    dict(key="gh",   kind="",         name="GithubStrategy"),
    dict(key="prov", kind="boundary", name="GitHub OAuth"),
    dict(key="repo", kind="",         name="AccountRepo"),
    dict(key="db",   kind="entity",   name="Postgres"),
])
sd.msg("page", "flow", "1: authenticate({ kind: \"github\", payload: { code } })")
sd.selfmsg("flow", "2: strategies().find(s => s.kind === payload.kind)")
sd.msg("flow", "gh", "3: verify({ code })")
sd.msg("gh", "prov", "4: exchangeCode(code)")
sd.ret("prov", "gh", "5: accessToken")
sd.msg("gh", "prov", "6: fetchVerifiedEmail(accessToken)")
sd.ret("prov", "gh", "7: verifiedEmail")
sd.msg("gh", "repo", "8: findOrCreateByExternalId(\"github\", id, verifiedEmail)")
sd.msg("repo", "db", "9: upsert accounts, credentials")
sd.ret("db", "repo", "10: account row")
sd.ret("repo", "gh", "11: account")
sd.ret("gh", "flow", "12: principal")
sd.selfmsg("flow", "13: onAuthenticated(principal)")
sd.msg("flow", "repo", "14: createAuthSession(principal.accountId)")
sd.msg("repo", "db", "15: insert into auth_sessions")
sd.ret("db", "repo", "16: token")
sd.ret("repo", "flow", "17: token")
sd.ret("flow", "page", "18: principal  +  Set-Cookie: lumen_session")
sd.draw("Figure 7 — Design sequence diagram: GitHub OAuth login",
        D_SUB + "\nMessages 12 to 18 are byte for byte the messages 11 to 17 of Figure 6. "
                "Only verify() differs, and the\nshared ending runs from onAuthenticated() "
                "in the base class — which is what the pattern was chosen for.",
        out("fig7-design-sd-oauth"))
print("7/7 design sequence diagram (OAuth)")
