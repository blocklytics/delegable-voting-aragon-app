const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { newDao, newApp } = require('./helpers/dao')
const { setOpenPermission } = require('./helpers/permissions')
const { assertAmountOfEvents } = require('@aragon/test-helpers/assertEvent')(web3)
const { getEventArgument } = require('@aragon/test-helpers/events')
const getBlockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const { encodeCallScript, EMPTY_SCRIPT } = require('@aragon/test-helpers/evmScript')
const { makeErrorMappingProxy } = require('@aragon/test-helpers/utils')
const ExecutionTarget = artifacts.require('ExecutionTarget')

const DelegableVoting = artifacts.require('DelegableVotingMock')
const DelegableMiniMeToken = artifacts.require('DelegableMiniMeToken')

const toBN = (x) => new web3.utils.BN(x)
const bigExp = (x, y) => toBN(x).mul(toBN(10).pow(toBN(y)))
const pct16 = x => bigExp(x, 16)
const createdVoteId = receipt => getEventArgument(receipt, 'StartVote', 'voteId')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const VOTER_STATE = ['ABSENT', 'YEA', 'NAY'].reduce((state, key, index) => {
    state[key] = index;
    return state;
}, {})


contract('DelegableVoting App', ([root, holder1, holder2, holder20, holder29, holder51, nonHolder, delegate1, delegate2]) => {
    let votingBase, voting, token, executionTarget

    let CREATE_VOTES_ROLE, MODIFY_SUPPORT_ROLE, MODIFY_QUORUM_ROLE

    // Error strings
    const errors = makeErrorMappingProxy({
        // aragonOS errors
        APP_AUTH_FAILED: 'Returned error:  APP_AUTH_FAILED',
        INIT_ALREADY_INITIALIZED: 'Returned error:  INIT_ALREADY_INITIALIZED',
        INIT_NOT_INITIALIZED: 'Returned error:  INIT_NOT_INITIALIZED',
        RECOVER_DISALLOWED: 'Returned error:  RECOVER_DISALLOWED',

        // Voting errors
        VOTING_NO_VOTE: "Returned error:  VOTING_NO_VOTE",
        VOTING_INIT_PCTS: "Returned error:  VOTING_INIT_PCTS",
        VOTING_CHANGE_SUPPORT_PCTS: "Returned error:  VOTING_CHANGE_SUPPORT_PCTS",
        VOTING_CHANGE_QUORUM_PCTS: "Returned error:  VOTING_CHANGE_QUORUM_PCTS",
        VOTING_INIT_SUPPORT_TOO_BIG: "Returned error:  VOTING_INIT_SUPPORT_TOO_BIG",
        VOTING_CHANGE_SUPP_TOO_BIG: "Returned error:  VOTING_CHANGE_SUPP_TOO_BIG",
        VOTING_CAN_NOT_VOTE: "Returned error:  VOTING_CAN_NOT_VOTE",
        VOTING_CAN_NOT_EXECUTE: "Returned error:  VOTING_CAN_NOT_EXECUTE",
        VOTING_CAN_NOT_FORWARD: "Returned error:  VOTING_CAN_NOT_FORWARD",
        VOTING_NO_VOTING_POWER: "Returned error:  VOTING_NO_VOTING_POWER",

        // Delegation errors
        EXCEED_DELEGATION_LIMIT: "Returned error:  EXCEED_DELEGATION_LIMIT",
        EXCEED_UNDELEGATION_LIMIT: "Returned error:  EXCEED_UNDELEGATION_LIMIT"
    })

    const NOW = 1
    const votingDuration = 1000

    before('deploy base app', async () => {
      // Deploy the app's base contract.
        votingBase = await DelegableVoting.new()

        // Setup constants
        CREATE_VOTES_ROLE = await votingBase.CREATE_VOTES_ROLE()
        MODIFY_SUPPORT_ROLE = await votingBase.MODIFY_SUPPORT_ROLE()
        MODIFY_QUORUM_ROLE = await votingBase.MODIFY_QUORUM_ROLE()
    })

    beforeEach('deploy dao and app', async () => {
        const { dao, acl } = await newDao(root)
        const proxyAddress = await newApp(dao, 'delegable-voting', votingBase.address, root)
        voting = await DelegableVoting.at(proxyAddress)
        await voting.mockSetTimestamp(NOW)

        await acl.createPermission(ANY_ADDR, voting.address, CREATE_VOTES_ROLE, root, { from: root })
        await acl.createPermission(ANY_ADDR, voting.address, MODIFY_SUPPORT_ROLE, root, { from: root })
        await acl.createPermission(ANY_ADDR, voting.address, MODIFY_QUORUM_ROLE, root, { from: root })
    })

    context('normal token supply, common tests', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', false, true) // empty parameters minime

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration)

            executionTarget = await ExecutionTarget.new()
        })

        it('fails on reinitialization', async () => {
            await assertRevert(voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration), errors.INIT_ALREADY_INITIALIZED)
        })

        it('cannot initialize base app', async () => {
            const newVoting = await DelegableVoting.new()
            assert.isTrue(await newVoting.isPetrified())
            await assertRevert(newVoting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration), errors.INIT_ALREADY_INITIALIZED)
        })

        it('checks it is forwarder', async () => {
            assert.isTrue(await voting.isForwarder())
        })

        it('can change required support', async () => {
            const receipt = await voting.changeSupportRequiredPct(neededSupport.add(toBN(1)))
            assertAmountOfEvents(receipt, 'ChangeSupportRequired')

            assert.equal((await voting.supportRequiredPct()).toString(), neededSupport.add(toBN(1)).toString(), 'should have changed required support')
        })

        it('fails changing required support lower than minimum acceptance quorum', async () => {
            await assertRevert(voting.changeSupportRequiredPct(minimumAcceptanceQuorum.sub(toBN(1))), errors.VOTING_CHANGE_SUPPORT_PCTS)
        })

        it('fails changing required support to 100% or more', async () => {
            await assertRevert(voting.changeSupportRequiredPct(pct16(101)), errors.VOTING_CHANGE_SUPP_TOO_BIG)
            await assertRevert(voting.changeSupportRequiredPct(pct16(100)), errors.VOTING_CHANGE_SUPP_TOO_BIG)
        })

        it('can change minimum acceptance quorum', async () => {
            const receipt = await voting.changeMinAcceptQuorumPct(1)
            assertAmountOfEvents(receipt, 'ChangeMinQuorum')

            assert.equal(await voting.minAcceptQuorumPct(), 1, 'should have changed acceptance quorum')
        })

        it('fails changing minimum acceptance quorum to greater than min support', async () => {
            await assertRevert(voting.changeMinAcceptQuorumPct(neededSupport.add(toBN(1))), errors.VOTING_CHANGE_QUORUM_PCTS)
        })

    })

    for (const decimals of [0, 2, 18, 26]) {
        context(`normal token supply, ${decimals} decimals`, () => {
            const neededSupport = pct16(50)
            const minimumAcceptanceQuorum = pct16(20)

            beforeEach(async () => {
                token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', decimals, 'n', false, true) // empty parameters minime

                await token.generateTokens(holder20, bigExp(20, decimals))
                await token.generateTokens(holder29, bigExp(29, decimals))
                await token.generateTokens(holder51, bigExp(51, decimals))

                await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration)

                executionTarget = await ExecutionTarget.new()
            })

            it('deciding voting is automatically executed', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.methods.execute().encodeABI() }
                const script = encodeCallScript([action])
                await voting.newVote(script, '', { from: holder51 })
                assert.equal(await executionTarget.counter(), 1, 'should have received execution call')
            })

            it('deciding voting is automatically executed (long version)', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.methods.execute().encodeABI() }
                const script = encodeCallScript([action])
                await voting.newVoteExt(script, '', true, true, { from: holder51 })
                assert.equal(await executionTarget.counter(), 1, 'should have received execution call')
            })

            it('execution scripts can execute multiple actions', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.methods.execute().encodeABI() }
                const script = encodeCallScript([action, action, action])
                await voting.newVote(script, '', { from: holder51 })
                assert.equal(await executionTarget.counter(), 3, 'should have executed multiple times')
            })

            it('execution script can be empty', async () => {
                await voting.newVote(encodeCallScript([]), '', { from: holder51 })
            })

            it('execution throws if any action on script throws', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.methods.execute().encodeABI() }
                let script = encodeCallScript([action])
                script = script.slice(0, -2) // remove one byte from calldata for it to fail
                await assertRevert(voting.newVote(script, '', { from: holder51 }))
            })

            it('forwarding creates vote', async () => {
                const action = { to: executionTarget.address, calldata: executionTarget.contract.methods.execute().encodeABI() }
                const script = encodeCallScript([action])
                const voteId = createdVoteId(await voting.forward(script, { from: holder51 }))
                assert.equal(voteId, 0, 'voting should have been created')
            })

            context('creating vote', () => {
                let script, voteId, creator, metadata

                beforeEach(async () => {
                    const action = { to: executionTarget.address, calldata: executionTarget.contract.methods.execute().encodeABI() }
                    script = encodeCallScript([action, action])

                    const receipt = await voting.newVoteExt(script, 'metadata', false, false, { from: holder51 });
                    voteId = getEventArgument(receipt, 'StartVote', 'voteId')
                    creator = getEventArgument(receipt, 'StartVote', 'creator')
                    metadata = getEventArgument(receipt, 'StartVote', 'metadata')
                })

                it('has correct state', async () => {
                    const result = await voting.getVote(voteId);
                    const [isOpen, isExecuted, startDate, snapshotBlock, supportRequired, minQuorum, y, n, votingPower, execScript] = Object.values(result);
                    assert.isTrue(result["open"], 'vote should be open')
                    assert.isFalse(isExecuted, 'vote should not be executed')
                    assert.equal(creator, holder51, 'creator should be correct')
                    assert.equal(snapshotBlock.toString(), await getBlockNumber() - 1, 'snapshot block should be correct')
                    assert.equal(supportRequired.toString(), neededSupport.toString(), 'required support should be app required support')
                    assert.equal(minQuorum.toString(), minimumAcceptanceQuorum.toString(), 'min quorum should be app min quorum')
                    assert.equal(y, 0, 'initial yea should be 0')
                    assert.equal(n, 0, 'initial nay should be 0')
                    assert.equal(votingPower.toString(), bigExp(100, decimals).toString(), 'voting power should be 100')
                    assert.equal(execScript, script, 'script should be correct')
                    assert.equal(metadata, 'metadata', 'should have returned correct metadata')
                    assert.equal(await voting.getVoterState(voteId, nonHolder), VOTER_STATE.ABSENT, 'nonHolder should not have voted')
                })

                it('fails getting a vote out of bounds', async () => {
                    await assertRevert(voting.getVote(voteId + 1), errors.VOTING_NO_VOTE)
                })

                it('changing required support does not affect vote required support', async () => {
                    await voting.changeSupportRequiredPct(pct16(70))

                    // With previous required support at 50%, vote should be approved
                    // with new quorum at 70% it shouldn't have, but since min quorum is snapshotted
                    // it will succeed

                    await voting.vote(voteId, true, false, { from: holder51 })
                    await voting.vote(voteId, true, false, { from: holder20 })
                    await voting.vote(voteId, false, false, { from: holder29 })
                    await voting.mockIncreaseTime(votingDuration + 1)

                    const result = await voting.getVote(voteId);
                    const state = Object.values(result);
                    assert.equal(state[4].toString(), neededSupport.toString(), 'required support in vote should stay equal')
                    await voting.executeVote(voteId) // exec doesn't fail
                })

                it('changing min quorum doesnt affect vote min quorum', async () => {
                    await voting.changeMinAcceptQuorumPct(pct16(50))

                    // With previous min acceptance quorum at 20%, vote should be approved
                    // with new quorum at 50% it shouldn't have, but since min quorum is snapshotted
                    // it will succeed

                    await voting.vote(voteId, true, true, { from: holder29 })
                    await voting.mockIncreaseTime(votingDuration + 1)
                    
                    const result = await voting.getVote(voteId);
                    const state = Object.values(result);
                    assert.equal(state[5].toString(), minimumAcceptanceQuorum.toString(), 'acceptance quorum in vote should stay equal')
                    await voting.executeVote(voteId) // exec doesn't fail
                })

                it('holder can vote', async () => {
                    await voting.vote(voteId, false, true, { from: holder29 })
                    const result = await voting.getVote(voteId);
                    const state = Object.values(result);
                    const voterState = await voting.getVoterState(voteId, holder29)

                    assert.equal(state[7].toString(), bigExp(29, decimals).toString(), 'nay vote should have been counted')
                    assert.equal(voterState, VOTER_STATE.NAY, 'holder29 should have nay voter status')
                })

                it('holder can modify vote', async () => {
                    await voting.vote(voteId, true, true, { from: holder29 })
                    await voting.vote(voteId, false, true, { from: holder29 })
                    await voting.vote(voteId, true, true, { from: holder29 })
                    const result = await voting.getVote(voteId);;
                    const state = Object.values(result);

                    assert.equal(state[6].toString(), bigExp(29, decimals).toString(), 'yea vote should have been counted')
                    assert.equal(state[7], 0, 'nay vote should have been removed')
                })

                it('token holders can delegate voting power to a single entity', async () => {
                    const holderBalance = await token.balanceOf(holder29)
                    await token.delegate(delegate1, holderBalance, { from: holder29 })
                    const delegateVotingShareAfter = await token.shares(delegate1)
                    const holderVotingShareAfter = await token.shares(holder29)
                    assert.equal(holderVotingShareAfter, 0, 'voting share should be 0 at current block')
                    assert.equal(holderBalance.toString(), delegateVotingShareAfter.toString(), 'voting share should have increased by holder balance at current block')
                })

                it('token holders can undelegate voting power from a single entity', async () => {
                    const holderBalance = await token.balanceOf(holder29)
                    await token.delegate(delegate1, holderBalance, { from: holder29 })
                    const delegateVotingShareBefore = await token.shares(delegate1)
                    const holderVotingShareBefore = await token.shares(holder29)
                    assert.equal(holderVotingShareBefore, 0, 'holder voting share should be 0 at current block')
                    assert.equal(holderBalance.toString(), delegateVotingShareBefore.toString(), 'delegate voting share should have increased by holder balance at current block')
                    await token.undelegate(delegate1, holderBalance, { from: holder29 })
                    const delegateVotingShareAfter = await token.shares(delegate1)
                    const holderVotingShareAfter = await token.shares(holder29)
                    assert.equal(delegateVotingShareAfter, 0, 'delegate voting share should be 0 at current block')
                    assert.equal(holderBalance.toString(), holderVotingShareAfter.toString(), 'holder voting share should have increased by delegated balance at current block')
                })

                it('token holders can delegate voting power to multiple entities', async () => {
                    const holderBalance = await token.balanceOf(holder29)
                    const halfHolderBalance = holderBalance.div(toBN(2))
                    const remainingBalance = holderBalance.sub(halfHolderBalance)
                    await token.delegate(delegate1, halfHolderBalance, { from: holder29 })
                    const delegate1VotingShareAfter = await token.shares(delegate1)
                    const holderVotingShareAfter1 = await token.shares(holder29)
                    assert.equal(holderVotingShareAfter1.toString(), remainingBalance.toString(), 'holder voting share should be half of balance at current block')
                    assert.equal(halfHolderBalance.toString(), delegate1VotingShareAfter.toString(), 'delegate 1 voting share should have increased by half of holder balance at current block')
                    await token.delegate(delegate2, remainingBalance, { from: holder29 })
                    const delegate2VotingShareAfter = await token.shares(delegate2)
                    const holderVotingShareAfter2 = await token.shares(holder29)
                    assert.equal(holderVotingShareAfter2.toString(), 0, 'holder voting share should be 0 at current block')
                    assert.equal(remainingBalance.toString(), delegate2VotingShareAfter.toString(), 'delegate 2 voting share should have increased by half of holder balance at current block')
                })

                it('token holders can undelegate voting power from multiple entities', async () => {
                    const holderBalance = await token.balanceOf(holder29)
                    const halfHolderBalance = holderBalance.div(toBN(2))
                    const remainingBalance = holderBalance.sub(halfHolderBalance)
                    await token.delegate(delegate1, halfHolderBalance, { from: holder29 })
                    const delegate1VotingShareAfter = await token.shares(delegate1)
                    const holderVotingShareAfter1 = await token.shares(holder29)
                    assert.equal(holderVotingShareAfter1.toString(), remainingBalance.toString(), 'holder voting share should be half of balance at current block')
                    assert.equal(halfHolderBalance.toString(), delegate1VotingShareAfter.toString(), 'delegate 1 voting share should have increased by half of holder balance at current block')
                    await token.delegate(delegate2, remainingBalance, { from: holder29 })
                    const delegate2VotingShareAfter = await token.shares(delegate2)
                    const holderVotingShareAfter2 = await token.shares(holder29)
                    assert.equal(holderVotingShareAfter2.toString(), 0, 'holder voting share should be 0 at current block')
                    assert.equal(remainingBalance.toString(), delegate2VotingShareAfter.toString(), 'delegate 2 voting share should have increased by half of holder balance at current block')
                    await token.undelegate(delegate1, halfHolderBalance, { from: holder29 })
                    const delegate1VotingShareEnd = await token.shares(delegate1)
                    const holderVotingShareAfter3 = await token.shares(holder29)
                    assert.equal(delegate1VotingShareEnd, 0, 'delegate 1 voting share should be 0 at current block')
                    assert.equal(halfHolderBalance.toString(), holderVotingShareAfter3.toString(), 'holder voting share should have increased by delegated balance at current block')
                    await token.undelegate(delegate2, remainingBalance, { from: holder29 })
                    const delegate2VotingShareEnd = await token.shares(delegate2)
                    const holderVotingShareAfter4 = await token.shares(holder29)
                    assert.equal(delegate2VotingShareEnd, 0, 'delegate 2 voting share should be 0 at current block')
                    assert.equal(holderBalance.toString(), holderVotingShareAfter4.toString(), 'holder voting share should have increased to original level at current block')
                })

                it('throws when voter tries to delegate more votes than their balance', async () => {
                    const holder51Balance = await token.balanceOf(holder51)
                    await assertRevert(token.delegate(delegate1, holder51Balance.add(toBN(1)), { from: holder51 }), errors.EXCEED_DELEGATION_LIMIT)
                })

                it('throws when voter tries to delegate more votes than their undelegated balance', async () => {
                    const holder51Balance = await token.balanceOf(holder51)
                    const halfHolderBalance = holder51Balance.div(toBN(2))
                    await token.delegate(delegate1, halfHolderBalance, { from: holder51 })
                    await assertRevert(token.delegate(delegate1, holder51Balance, { from: holder51 }), errors.EXCEED_DELEGATION_LIMIT)
                })

                it('throws when voter tries to undelegate more votes than they have delegated', async () => {
                    const holder51Balance = await token.balanceOf(holder51)
                    await assertRevert(token.undelegate(delegate1, holder51Balance, { from: holder51 }), errors.EXCEED_UNDELEGATION_LIMIT)
                })

                it('throws when fully delegated voter votes', async () => {
                    const holder51Balance = await token.balanceOf(holder51)
                    await token.delegate(delegate1, holder51Balance, { from: holder51 })
                    const newVoteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata'))
                    await assertRevert(voting.vote(newVoteId, true, true, { from: holder51 }), errors.VOTING_CAN_NOT_VOTE)
                })

                it('throws when non-holder votes', async () => {
                    await assertRevert(voting.vote(voteId, true, true, { from: nonHolder }), errors.VOTING_CAN_NOT_VOTE)
                })

                it('throws when voting after voting closes', async () => {
                    await voting.mockIncreaseTime(votingDuration + 1)
                    await assertRevert(voting.vote(voteId, true, true, { from: holder29 }), errors.VOTING_CAN_NOT_VOTE)
                })

                it('can execute if vote is approved with support and quorum', async () => {
                    await voting.vote(voteId, true, true, { from: holder29 })
                    await voting.vote(voteId, false, true, { from: holder20 })
                    await voting.mockIncreaseTime(votingDuration + 1)
                    await voting.executeVote(voteId)
                    assert.equal(await executionTarget.counter(), 2, 'should have executed result')
                })

                it('cannot execute vote if not enough quorum met', async () => {
                    await voting.vote(voteId, true, true, { from: holder20 })
                    await voting.mockIncreaseTime(votingDuration + 1)
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('cannot execute vote if not support met', async () => {
                    await voting.vote(voteId, false, true, { from: holder29 })
                    await voting.vote(voteId, false, true, { from: holder20 })
                    await voting.mockIncreaseTime(votingDuration + 1)
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('vote can be executed automatically if decided', async () => {
                    await voting.vote(voteId, true, true, { from: holder51 }) // causes execution
                    assert.equal(await executionTarget.counter(), 2, 'should have executed result')
                })

                it('vote can be not executed automatically if decided', async () => {
                    await voting.vote(voteId, true, false, { from: holder51 }) // doesnt cause execution
                    await voting.executeVote(voteId)
                    assert.equal(await executionTarget.counter(), 2, 'should have executed result')
                })

                it('cannot re-execute vote', async () => {
                    await voting.vote(voteId, true, true, { from: holder51 }) // causes execution
                    await assertRevert(voting.executeVote(voteId), errors.VOTING_CAN_NOT_EXECUTE)
                })

                it('cannot vote on executed vote', async () => {
                    await voting.vote(voteId, true, true, { from: holder51 }) // causes execution
                    await assertRevert(voting.vote(voteId, true, true, { from: holder20 }), errors.VOTING_CAN_NOT_VOTE)
                })
            })
        })
    }

    context('wrong initializations', () => {
        beforeEach(async() => {
            token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', false, true) // empty parameters minime
        })

        it('fails if min acceptance quorum is greater than min support', async () => {
            const neededSupport = pct16(20)
            const minimumAcceptanceQuorum = pct16(50)
            await assertRevert(voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration), errors.VOTING_INIT_PCTS)
        })

        it('fails if min support is 100% or more', async () => {
            const minimumAcceptanceQuorum = pct16(20)
            await assertRevert(voting.initialize(token.address, pct16(101), minimumAcceptanceQuorum, votingDuration), errors.VOTING_INIT_SUPPORT_TOO_BIG)
            await assertRevert(voting.initialize(token.address, pct16(100), minimumAcceptanceQuorum, votingDuration), errors.VOTING_INIT_SUPPORT_TOO_BIG)
        })
    })

    context('empty token', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async() => {
            token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', false, true) // empty parameters minime

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration)
        })

        it('fails creating a vote if token has no holder', async () => {
            await assertRevert(voting.newVote(EMPTY_SCRIPT, 'metadata'), errors.VOTING_NO_VOTING_POWER)
        })
    })

    context('token supply = 1', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', false, true) // empty parameters minime

            await token.generateTokens(holder1, 1)

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration)
        })

        it('new vote cannot be executed before voting', async () => {
            // Account creating vote does not have any tokens and therefore doesn't vote
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata'))

            assert.isFalse(await voting.canExecute(voteId), 'vote cannot be executed')

            await voting.vote(voteId, true, true, { from: holder1 })

            const result = await voting.getVote(voteId);
            const [isOpen, isExecuted] = Object.values(result);

            assert.isFalse(isOpen, 'vote should be closed')
            assert.isTrue(isExecuted, 'vote should have been executed')

        })

        context('new vote parameters', () => {
            it('creating vote as holder executes vote (if _canExecute param says so)', async () => {
                const voteId = createdVoteId(await voting.newVoteExt(EMPTY_SCRIPT, 'metadata', true, true, { from: holder1 }))
                const result = await voting.getVote(voteId);
                const [isOpen, isExecuted] = Object.values(result);

                assert.isFalse(isOpen, 'vote should be closed')
                assert.isTrue(isExecuted, 'vote should have been executed')
            })

            it("creating vote as holder doesn't execute vote if _canExecute param doesn't says so", async () => {
                const voteId = createdVoteId(await voting.newVoteExt(EMPTY_SCRIPT, 'metadata', true, false, { from: holder1 }))
                const result = await voting.getVote(voteId);
                const [isOpen, isExecuted] = Object.values(result);

                assert.isTrue(isOpen, 'vote should be open')
                assert.isFalse(isExecuted, 'vote should not have been executed')
            })
        })
    })

    context('token supply = 3', () => {
        const neededSupport = pct16(34)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', false, true) // empty parameters minime

            await token.generateTokens(holder1, 1)
            await token.generateTokens(holder2, 2)

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration)
        })

        it('new vote cannot be executed before holder2 voting', async () => {
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata'))

            assert.isFalse(await voting.canExecute(voteId), 'vote cannot be executed')

            await voting.vote(voteId, true, true, { from: holder1 })
            await voting.vote(voteId, true, true, { from: holder2 })

            const result = await voting.getVote(voteId);
            const [isOpen, isExecuted] = Object.values(result);

            assert.isFalse(isOpen, 'vote should be closed')
            assert.isTrue(isExecuted, 'vote should have been executed')
        })

        it('creating vote as holder2 executes vote', async () => {
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata', { from: holder2 }))
            const result = await voting.getVote(voteId);
            const [isOpen, isExecuted] = Object.values(result);

            assert.isFalse(isOpen, 'vote should be closed')
            assert.isTrue(isExecuted, 'vote should have been executed')
        })
    })

    context('changing token supply', () => {
        const neededSupport = pct16(50)
        const minimumAcceptanceQuorum = pct16(20)

        beforeEach(async () => {
            token = await DelegableMiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'n', 0, 'n', false, true) // empty parameters minime

            await token.generateTokens(holder1, 1)
            await token.generateTokens(holder2, 1)

            await voting.initialize(token.address, neededSupport, minimumAcceptanceQuorum, votingDuration)
        })

        it('uses the correct snapshot value if tokens are minted afterwards', async () => {
            // Create vote and afterwards generate some tokens
            const voteId = createdVoteId(await voting.newVote(EMPTY_SCRIPT, 'metadata'))
            await token.generateTokens(holder2, 1)

            const result = await voting.getVote(voteId);
            const [isOpen, isExecuted, startDate, snapshotBlock, supportRequired, minQuorum, y, n, votingPower, execScript] = Object.values(result);

            // Generating tokens advanced the block by one
            assert.equal(snapshotBlock.toString(), await getBlockNumber() - 2, 'snapshot block should be correct')
            assert.equal(votingPower.toString(), (await token.totalSupplyAt(snapshotBlock)).toString(), 'voting power should match snapshot supply')
            assert.equal(votingPower.toString(), 2, 'voting power should be correct')
        })

        it('uses the correct snapshot value if tokens are minted in the same block', async () => {
            // Create vote and generate some tokens in the same transaction
            // Requires the voting mock to be the token's owner
            await token.changeController(voting.address)
            const voteId = createdVoteId(await voting.newTokenAndVote(holder2, 1, 'metadata'))

            const result = await voting.getVote(voteId);
            const [isOpen, isExecuted, startDate, snapshotBlock, supportRequired, minQuorum, y, n, votingPower, execScript] = Object.values(result);

            assert.equal(snapshotBlock.toString(), await getBlockNumber() - 1, 'snapshot block should be correct')
            assert.equal(votingPower.toString(), (await token.totalSupplyAt(snapshotBlock)).toString(), 'voting power should match snapshot supply')
            assert.equal(votingPower.toString(), 2, 'voting power should be correct')
        })
    })

    context('before init', () => {
        it('fails creating a vote before initialization', async () => {
            await assertRevert(voting.newVote(encodeCallScript([]), ''), errors.APP_AUTH_FAILED)
        })

        it('fails to forward actions before initialization', async () => {
            const action = { to: executionTarget.address, calldata: executionTarget.contract.methods.execute().encodeABI() }
            const script = encodeCallScript([action])
            await assertRevert(voting.forward(script, { from: holder51 }), errors.VOTING_CAN_NOT_FORWARD)
        })
    })

    context('isValuePct unit test', async () => {
        it('tests total = 0', async () => {
            const result1 = await voting.isValuePct(0, 0, pct16(50))
            assert.equal(result1, false, "total 0 should always return false")
            const result2 = await voting.isValuePct(1, 0, pct16(50))
            assert.equal(result2, false, "total 0 should always return false")
        })

        it('tests value = 0', async () => {
            const result1 = await voting.isValuePct(0, 10, pct16(50))
            assert.equal(result1, false, "value 0 should false if pct is non-zero")
            const result2 = await voting.isValuePct(0, 10, 0)
            assert.equal(result2, false, "value 0 should return false if pct is zero")
        })

        it('tests pct ~= 100', async () => {
            const result1 = await voting.isValuePct(10, 10, pct16(100).sub(toBN(1)))
            assert.equal(result1, true, "value 10 over 10 should pass")
        })

        it('tests strict inequality', async () => {
            const result1 = await voting.isValuePct(10, 20, pct16(50))
            assert.equal(result1, false, "value 10 over 20 should not pass for 50%")

            const result2 = await voting.isValuePct(pct16(50).sub(toBN(1)), pct16(100), pct16(50))
            assert.equal(result2, false, "off-by-one down should not pass")

            const result3 = await voting.isValuePct(pct16(50).add(toBN(1)), pct16(100), pct16(50))
            assert.equal(result3, true, "off-by-one up should pass")
        })
    })
})
