const fetch = require("node-fetch");
const fs = require("fs");

const pkg = require("./package.json");
const { getHeapSpaceStatistics } = require("v8");
const { resolve } = require("path");

const argv = require("minimist")(process.argv.slice(2));

const API_BASE_URL = "https://api.heroku.com";

let defaultTokenName = "HEROKU_TOKEN";
let defaultToken = process.env[defaultTokenName];

var config = {};

pkg.heroku.configvars.forEach((cv) => (config[cv] = process.env[cv] || null));

function fetchText(url) {
  //console.log("fetch text", url);
  return new Promise((resolve, reject) => {
    try {
      fetch(url)
        .then((response) => {
          //console.log("response", response);
          response
            .text()
            .then((text) => {
              //console.log("got text size", text.length);
              resolve(text);
            })
            .catch((err) => {
              const errMsg = `could not get response text ${err}`;
              console.log("error", errMsg);
              reject(errMsg);
            });
        })
        .catch((err) => {
          const errMsg = `could not get response ${err}`;
          console.log("error", errMsg);
          reject(errMsg);
        });
    } catch (err) {
      const errMsg = `fetch error ${err}`;
      console.log(errMsg);
      reject(errMsg);
    }
  });
}

function api(endpoint, method, payload, token) {
  return new Promise((resolve, reject) => {
    fetch(`${API_BASE_URL}/${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token || defaultToken}`,
        Accept: "application/vnd.heroku+json; version=3",
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    }).then(
      (resp) =>
        resp.json().then(
          (json) => resolve(json),
          (err) => {
            console.error(err);
            reject(err);
          }
        ),
      (err) => {
        console.error(err);
        reject(err);
      }
    );
  });
}

function get(endpoint, payload, token) {
  return api(endpoint, "GET", payload, token);
}

function post(endpoint, payload, token) {
  return api(endpoint, "POST", payload, token);
}

function del(endpoint, payload, token) {
  return api(endpoint, "DELETE", payload, token);
}

function patch(endpoint, payload, token) {
  return api(endpoint, "PATCH", payload, token);
}

function getSchema() {
  get("schema").then((json) =>
    fs.writeFileSync("schema.json", JSON.stringify(json, null, 2))
  );
}

function createApp(name, token) {
  return new Promise((resolve) => {
    post("apps", { name }, token).then((json) => {
      if (require.main === module) {
        console.log(json);
      }

      resolve(json);
    });
  });
}

function delApp(name, token) {
  return new Promise((resolve) => {
    del(`apps/${name}`, undefined, token).then((json) => {
      if (require.main === module) {
        console.log(json);
      }

      resolve(json);
    });
  });
}

function getConfig(name, token) {
  return new Promise((resolve) => {
    get(`apps/${name}/config-vars`, undefined, token).then((json) => {
      if (require.main === module) {
        console.log(json);
      }

      resolve(json);
    });
  });
}

function setConfig(name, configVars, token) {
  return new Promise((resolve) => {
    patch(`apps/${name}/config-vars`, configVars || config, token).then(
      (json) => {
        if (require.main === module) {
          console.log(json);
        }

        resolve(json);
      }
    );
  });
}

function getLogs(name, token, lines, tail) {
  return new Promise((resolve) => {
    post(
      `apps/${name}/log-sessions`,
      { lines: lines || 100, tail: tail || false },
      token
    ).then((json) => {
      fetchText(json.logplex_url)
        .then((text) => {
          //console.log("fetched logs text size", text.length);
          json.logText = `${text}`;
          json.logLines = json.logText
            .replace(/\r/g, "")
            .split("\n")
            .filter((line) => line.length);
          json.logItems = json.logLines.map((line) => {
            const m = line.match(/([^ ]+) ([^ ]+): (.*)/);
            return { time: m[1], dyno: m[2], content: m[3] };
          });

          if (require.main === module) {
            console.log(json);
          }

          resolve(json);
        })
        .catch((err) => {
          console.log("error fetching log text", err);
          json.error = err;
          json.logText = err;
          json.logLines = [];
          json.logItems = [];

          if (require.main === module) {
            console.log(json);
          }

          resolve(json);
        });
    });
  });
}

function getBuilds(name, token) {
  return new Promise((resolve) => {
    get(`apps/${name}/builds`, undefined, token).then((json) => {
      if (require.main === module) {
        console.log(json);
      }

      resolve(json);
    });
  });
}

function getApps(token) {
  return new Promise((resolve) => {
    get("apps", undefined, token).then((json) => {
      if (require.main === module) {
        console.log(json);
      }
      const alltokens = getAllTokens();
      json.forEach((app) => {
        app.herokuToken = token;
        app.herokuName = alltokens.tokensByToken[token].split("_")[2];
      });
      resolve(json);
    });
  });
}

function getAllApps() {
  return new Promise((resolve) => {
    const alltokens = getAllTokens();

    Promise.all(
      Object.keys(alltokens.tokensByToken).map((token) => getApps(token))
    ).then((appss) => {
      const apps = appss
        .flat()
        .sort((a, b) => {
          if (a.herokuName != b.herokuName)
            return a.herokuName.localeCompare(b.herokuName);
          return a.name.localeCompare(b.name);
        })
        .map((app) => {
          app.herokuIndex = alltokens.herokuNames.findIndex(
            (name) => app.herokuName === name
          );
          return app;
        });

      if (require.main === module) {
        console.log(apps);
      }

      resolve(apps);
    });
  });
}

function buildApp(name, url, token) {
  return new Promise((resolve) => {
    post(
      `apps/${name}/builds`,
      {
        source_blob: {
          checksum: null,
          url,
          version: null,
        },
      },
      token
    ).then((json) => {
      if (require.main === module) {
        console.log(json);
      }

      resolve(json);
    });
  });
}

function restartAllDynos(name, token) {
  return new Promise((resolve) => {
    del(`apps/${name}/dynos`, undefined, token).then((json) => {
      if (require.main === module) {
        console.log(json);
      }

      resolve(json);
    });
  });
}

function getAllTokens() {
  const tokensByName = {};
  const tokensByToken = {};
  const namesByName = {};
  const herokuNames = [];
  Object.keys(process.env)
    .filter((key) => key.match(new RegExp("^HEROKU_TOKEN_")))
    .forEach((token) => {
      const envToken = process.env[token];
      const herokuName = token.split("_")[2];
      tokensByName[token] = envToken;
      tokensByToken[envToken] = token;
      namesByName[token] = herokuName;
      herokuNames.push(herokuName);
    });
  return {
    tokensByName,
    tokensByToken,
    namesByName,
    herokuNames: herokuNames.sort((a, b) => a.localeCompare(b)),
  };
}

if (require.main !== module) {
  module.exports = {
    getApps,
    getAllTokens,
    getAllApps,
    createApp,
    delApp,
    getLogs,
    getBuilds,
    buildApp,
    getConfig,
    setConfig,
    restartAllDynos,
  };
} else {
  console.log("heroku command");

  const heroku = pkg.heroku;
  const command = argv._[0];
  delete argv._;

  const appName = argv.name || heroku.appname;
  const targzurl = argv.url || pkg.targzurl;

  if (argv.token) {
    defaultTokenName = defaultTokenName + "_" + argv.token.toUpperCase();
    defaultToken = process.env[defaultTokenName];
  }

  console.log(command, argv, defaultTokenName);

  if (command === "create") {
    createApp(appName);
  } else if (command === "del") {
    delApp(appName);
  } else if (command === "build") {
    buildApp(appName, targzurl);
  } else if (command === "schema") {
    getSchema();
  } else if (command === "getconfig") {
    getConfig(appName);
  } else if (command === "setconfig") {
    setConfig(appName);
  } else if (command === "getapps") {
    getApps();
  } else if (command === "getallapps") {
    getAllApps();
  } else if (command === "gettokens") {
    console.log(getAllTokens());
  } else if (command === "getlogs") {
    getLogs(appName);
  } else if (command === "getbuilds") {
    getBuilds(appName);
  } else if (command === "restartall") {
    restartAllDynos(appName);
  } else {
    console.error("unknown command");
  }
}
