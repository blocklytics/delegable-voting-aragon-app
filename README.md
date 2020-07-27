# Aragon Delegable Voting App

This is a fork of the 'Voting' app built by Aragon that gives voters the option to delegate their votes or vote for themselves.

## Install dependencies

To install dependencies, run `yarn install`

## Running this app

To run the app in a browser with frontend and contract hot-reloading, simply run `yarn start`.

## Publish app

First, save .env.sample as a new file (i.e. .env.dev) and fill in all of the config variables.  Then, in a terminal run `source .env.dev`

In the same terminal window, run `yarn publish:rinkeby:major` to deploy to rinkeby or `yarn publish:major` to deploy to mainnet.  You can also specify :minor or :patch instead of :major to deploy following SemVer.

### Hooks

These hooks are called by the Aragon Buidler plugin during the start task's lifecycle. Use them to perform custom tasks at certain entry points of the development build process, like deploying a token before a proxy is initialized, etc.

Link them to the main buidler configuration file (buidler.config.js) in the `aragon.hooks` property.

All hooks receive two parameters: 1) A params object that may contain other objects that pertain to the particular hook. 2) A "bre" or BuidlerRuntimeEnvironment object that contains environment objects like web3, Truffle artifacts, etc.

```
// Called before a dao is deployed.
preDao: async ({ log }, { web3, artifacts }) => {},

// Called after a dao is deployed.
postDao: async ({ dao, _experimentalAppInstaller, log }, { web3, artifacts }) => {},

// Called after the app's proxy is created, but before it's initialized.
preInit: async ({ proxy, _experimentalAppInstaller, log  }, { web3, artifacts }) => {},

// Called after the app's proxy is initialized.
postInit: async ({ proxy, _experimentalAppInstaller, log  }, { web3, artifacts }) => {},

// Called when the start task needs to know the app proxy's init parameters.
// Must return an array with the proxy's init parameters.
getInitParams: async ({ log }, { web3, artifacts }) => {
  return []
}
```

If you want an example of how to use these hooks, please see the [plugin's own tests for an example project](https://github.com/aragon/buidler-aragon/blob/master/test/projects/token-wrapper/scripts/hooks.js).

### Libraries

- [**@aragon/os**](https://github.com/aragon/aragonos): AragonApp smart contract interfaces.
- [**@aragon/api**](https://github.com/aragon/aragon.js/tree/master/packages/aragon-api): Aragon client application API.
- [**@aragon/ui**](https://github.com/aragon/aragon-ui): Aragon UI components (in React).
- [**@aragon/buidler-aragon**](https://github.com/aragon/buidler-aragon): Aragon Buidler plugin.
