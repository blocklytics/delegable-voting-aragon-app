/*
 * These hooks are called by the Aragon Buidler plugin during the start task's lifecycle. Use them to perform custom tasks at certain entry points of the development build process, like deploying a token before a proxy is initialized, etc.
 *
 * Link them to the main buidler config file (buidler.config.js) in the `aragon.hooks` property.
 *
 * All hooks receive two parameters:
 * 1) A params object that may contain other objects that pertain to the particular hook.
 * 2) A "bre" or BuidlerRuntimeEnvironment object that contains enviroment objects like web3, Truffle artifacts, etc.
 *
 * Please see AragonConfigHooks, in the plugin's types for further details on these interfaces.
 * https://github.com/aragon/buidler-aragon/blob/develop/src/types.ts#L31
 */

let token

module.exports = {
  // Called before a dao is deployed.
  preDao: async ({ log }, { web3, artifacts }) => {},

  // Called after a dao is deployed.
  postDao: async (
    { dao, _experimentalAppInstaller, log },
    { web3, artifacts }
  ) => {},

  // Called after the app's proxy is created, but before it's initialized.
  preInit: async (
    { proxy, _experimentalAppInstaller, log },
    { web3, artifacts }
  ) => {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
    const DelegableMiniMeToken = artifacts.require('DelegableMiniMeToken')
    token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', false, true)
    const DelegableMiniMeTokenFactory = artifacts.require('DelegableMiniMeTokenFactory')
    tokenFactory = await DelegableMiniMeTokenFactory.new()
    console.log("Token Factory: " + tokenFactory.address)
  },

  // Called after the app's proxy is initialized.
  postInit: async (
    { proxy, _experimentalAppInstaller, log },
    { web3, artifacts }
  ) => {},

  // Called when the start task needs to know the app proxy's init parameters.
  // Must return an array with the proxy's init parameters.
  getInitParams: async ({ log }, { web3, artifacts }) => {
    const toBN = (x) => new web3.utils.BN(x)
    const bigExp = (x, y) => toBN(x).mul(toBN(10).pow(toBN(y)))
    const pct16 = x => bigExp(x, 16)
    const tokenAddress = token ? token.address : undefined
    console.log("Token address: " + tokenAddress)
    const neededSupport = pct16(50)
    const minimumAcceptanceQuorum = pct16(20)
    const votingDuration = 1000
    return [tokenAddress, neededSupport, minimumAcceptanceQuorum, votingDuration]
  },

  // Called after the app's proxy is updated with a new implementation.
  postUpdate: async ({ proxy, log }, { web3, artifacts }) => {},
}
