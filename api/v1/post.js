const helpers = require("../helpers.js")
const bcrypt = require("bcrypt")
const saltRounds = 10




// ...
function createUser (req, res, _) {
    bcrypt.hash(req.body.password, saltRounds, (_, hash) => {
        let now = new Date()
        helpers.db
            .one(
                "INSERT INTO " +
                    "users(email, password_digest, created_at, updated_at) " +
                    "VALUES(${email}, ${password_digest}, ${created_at}, ${updated_at}) " +
                "RETURNING id",
                {
                    email: req.body.email,
                    password_digest: hash,
                    created_at: now,
                    updated_at: now,
                }
            )
            .then((result) => {
                res.status(201).json({
                    status: "success",
                    id: result.id,
                })
            })
            .catch((error) => {
                const retCode = helpers.errorMessageToRetCode(error.message)
                res.status(retCode).json({
                    status: "failure",
                    id: error.message,
                    code: retCode,
                })
            })
    })
}




// ...
function createAccount (req, res, _) {
    let now = new Date()
    helpers.db
        .one(
            "INSERT INTO " +
                "accounts(pubkey, path, alias, user_id, visible, created_at, updated_at, email_md5) " +
                "VALUES(${pubkey}, ${path}, ${alias}, ${user_id}, ${visible}, ${created_at}, ${updated_at}, ${email_md5}) " +
            "RETURNING id",
            {
                pubkey: req.params.pubkey,
                alias: (_) => {
                    return req.query.alias ?
                        req.query.alias :
                        null
                },
                path: req.query.path,
                user_id: req.params.user_id,
                visible: (_) => {
                    return req.query.visible == "false" ? false : true
                },
                created_at: now,
                updated_at: now,
                email_md5: req.query.md5,
            }
        )
        .then((result) => {
            res.status(201).json({
                success: true,
                account_id: result.id,
            })
        })
        .catch((error) => {
            const retCode = helpers.errorMessageToRetCode(error.message)
            res.status(retCode).json({
                status: "failure",
                id: error.message,
                code: retCode,
            })
        })
}




// ...
function userData (req, res, next) {
    if (!helpers.tokenIsValid(req.body.token, req.body.id)) {
        return res.status(403).json({
            error: "Forbidden",
        })
    }
    helpers.db
        .one("SELECT * FROM users WHERE id = ${id}", {
            id: req.body.id,
        })
        .then((dbData) => {
            res.status(200).json({
                status: "success",
                data: dbData,
            })
        })
        .catch((error) => {
            return next(error.message)
        })
}




// ...
function accountData (req, res, next) {
    if (!helpers.tokenIsValid(req.body.token, req.body.id)) {
        return res.status(403).json({
            error: "Forbidden",
        })
    }
    helpers.db
        .one("SELECT * FROM accounts WHERE user_id = ${user_id}", {
            user_id: req.body.id,
        })
        .then((dbData) => {
            res.status(200).json({
                status: "success",
                data: dbData,
            })
        })
        .catch((error) => {
            return next(error.message)
        })
}




// ...
function updateUser (req, res, _next) {
    if (!helpers.tokenIsValid(req.body.token, req.body.id)) {
        return res.status(403).json({
            error: "Forbidden",
        })
    }
    helpers.db
        .tx((t) => {
            return t.batch([
                req.body.first_name ?
                    t.none("UPDATE users SET first_name = $1 WHERE id = $2", [
                        req.body.first_name,
                        req.body.id,
                    ]) :
                    null,
                req.body.last_name ?
                    t.none("UPDATE users SET last_name = $1 WHERE id = $2", [
                        req.body.last_name,
                        req.body.id,
                    ]) :
                    null,
                t.none("UPDATE users SET updated_at = $1 WHERE id = $2", [
                    new Date(),
                    req.body.id,
                ]),
            ])
        })
        .then((_data) => {
            res.status(204).json({
                status: "success",
            })
        })
        .catch((error) => {
            res.status(500).json({
                error: error.message,
            })
        })
}




// ..
function updateAccount (req, res, _next) {
    if (!helpers.tokenIsValid(req.body.token, req.body.id)) {
        return res.status(403).json({
            error: "Forbidden",
        })
    }

    const federationCheck = new RegExp(
        [
            /^([a-zA-Z\-0-9.@]+)\*/,
            /((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        ]
            .map((r) => r.source)
            .join("")
    )

    let alias = null,
        domain = null

    if (req.body.alias) {
        const federationMatch = req.body.alias.match(federationCheck)
        alias = federationMatch ? federationMatch[1] : null
        domain = federationMatch ? federationMatch[2] : null
    }

    helpers.db
        .tx((t) => {
            return t.batch([
                t.none(
                    "UPDATE accounts SET memo_type = $1, memo = $3 WHERE user_id = $2",
                    [req.body.memo_type, req.body.id, req.body.memo,]
                ),
                req.body.alias ?
                    t.none(
                        "UPDATE accounts SET alias = $1, domain = $3 WHERE user_id = $2",
                        [alias, req.body.id, domain,]
                    ) :
                    null,
                req.body.visible ?
                    t.none(
                        "UPDATE accounts SET visible = ${visible} WHERE user_id = ${user_id}",
                        {
                            visible: () => {
                                return req.body.visible == "false"
                                    ? false
                                    : true
                            },
                            user_id: req.body.id,
                        }
                    ) :
                    null,
                req.body.currency ?
                    t.none(
                        "UPDATE accounts SET currency = $1 WHERE user_id = $2",
                        [req.body.currency, req.body.id,]
                    ) :
                    null,
                req.body.precision ?
                    t.none(
                        "UPDATE accounts SET precision = $1 WHERE user_id = $2",
                        [req.body.precision, req.body.id,]
                    ) :
                    null,
                t.none("UPDATE accounts SET updated_at = $1", [new Date(),]),
            ])
        })
        .then((_) => {
            res.status(204).json({
                status: "success",
            })
        })
        .catch((error) => {
            if (/alias_domain/.test(error.message)) {
                res.status(409).json({
                    error: "This payment address is already reserved.",
                })
            } else {
                res.status(500).json({
                    error: error.message,
                })
            }
        })
}




//  ...
function issueToken (req, res, _) {
    helpers.db
        .any(
            "SELECT user_id FROM ACCOUNTS WHERE pubkey = ${pubkey} AND path = ${path}",
            {
                pubkey: req.params.pubkey,
                path: req.params.path,
            }
        )
        .then((dbData) => {
            bcrypt.hash(
                `${helpers.getApiKey()}${dbData[0].user_id}`,
                saltRounds,
                (_, hash) => {
                    // authenticated
                    res.status(200).json({
                        authenticated: true,
                        user_id: dbData[0].user_id,
                        token: new Buffer(hash).toString("base64"),
                    })
                }
            )
        })
        .catch((_) => {
            res.status(401).json({
                authenticated: false,
                user_id: null,
                token: null,
            })
        })
}




// ...
function authenticate (req, res, next) {
    helpers.db
        .any("SELECT * FROM users WHERE email = ${email}", {
            email: req.body.email,
        })
        .then((dbData) => {
            // user found
            if (dbData.length === 1) {
                bcrypt.compare(
                    req.body.password,
                    dbData[0].password_digest,
                    (_err, auth) => {
                        if (auth) {
                            helpers.db
                                .one(
                                    "SELECT pubkey, path " +
                                    "FROM accounts " +
                                    "WHERE user_id = ${user_id}",
                                    {
                                        user_id: dbData[0].id,
                                    }
                                )
                                .then((dbAccount) => {
                                    bcrypt.hash(
                                        `${helpers.getApiKey()}${dbData[0].id}`,
                                        saltRounds,
                                        (_error, hash) => {
                                            // authenticated
                                            res.status(200).json({
                                                authenticated: true,
                                                user_id: dbData[0].id,
                                                pubkey: dbAccount.pubkey,
                                                bip32Path: dbAccount.path,
                                                token: new Buffer(
                                                    hash
                                                ).toString("base64"),
                                            })
                                        }
                                    )
                                })
                                .catch((error) => {
                                    // eslint-disable-next-line no-console
                                    console.log(next(error.message))
                                })
                        } else {
                            // not authenticated
                            res.status(401).json({
                                authenticated: false,
                                user_id: null,
                                pubkey: null,
                                bip32Path: null,
                                error: "Invalid credentials.",
                            })
                        }
                    }
                )
            } else {
                // user not found in DB
                res.status(401).json({
                    authenticated: false,
                    user_id: null,
                    pubkey: null,
                    bip32Path: null,
                    error: "Invalid credentials.",
                })
            }
        })
        .catch((error) => {
            // eslint-disable-next-line no-console
            console.log(error)
            res.status(500).json({
                error: error.message,
            })
        })
}




//...
module.exports = {
    updateUser: updateUser,
    authenticate: authenticate,
    createAccount: createAccount,
    updateAccount: updateAccount,
    createUser,
    issueToken,
    userData,
    accountData,
}
