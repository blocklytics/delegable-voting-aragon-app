import { useMemo } from 'react'
import { useAragonApi } from '@aragon/api-react'
import { 
  getUserBalanceAt, 
  getUserBalanceNow, 
  getUserVotingSharesAt, 
  getUserVotingSharesNow, 
  getUserDelegateToAt, 
  getUserDelegatedToNow, 
  getUserDelegateFromAt, 
  getUserDelegatedFromNow 
} from '../token-utils'
import { getCanExecute, getCanVote } from '../vote-utils'
import useTokenContract from './useTokenContract'
import usePromise from './usePromise'

// Get the extended data related to a vote
export default function useExtendedVoteData(vote) {
  const {
    api,
    connectedAccount,
    appState: { tokenDecimals },
  } = useAragonApi()

  const tokenContract = useTokenContract()

  const canExecutePromise = useMemo(() => getCanExecute(vote, api), [api, vote])
  const canExecute = usePromise(canExecutePromise, [], false)

  const canUserVotePromise = useMemo(
    () => getCanVote(vote, connectedAccount, api),
    [vote, connectedAccount, api]
  )
  const canUserVote = usePromise(canUserVotePromise, [], false)

  const userBalancePromise = useMemo(() => {
    if (!vote) {
      return -1
    }
    return getUserBalanceAt(
      connectedAccount,
      vote.data.snapshotBlock,
      tokenContract,
      tokenDecimals
    )
  }, [connectedAccount, tokenContract, tokenDecimals, vote])
  const userBalance = usePromise(userBalancePromise, [], -1)

  const userBalanceNowPromise = useMemo(
    () => getUserBalanceNow(connectedAccount, tokenContract, tokenDecimals),
    [connectedAccount, tokenContract, tokenDecimals]
  )
  const userBalanceNow = usePromise(userBalanceNowPromise, [], -1)

  const userVotingSharesPromise = useMemo(() => {
    if (!vote) {
      return -1
    }
    return getUserVotingSharesAt(
      connectedAccount,
      vote.data.snapshotBlock,
      tokenContract,
      tokenDecimals
    )
  }, [connectedAccount, tokenContract, tokenDecimals, vote])
  const userVotingShares = usePromise(userVotingSharesPromise, [], -1)

  const userVotingSharesNowPromise = useMemo(
    () => getUserVotingSharesNow(connectedAccount, tokenContract, tokenDecimals),
    [connectedAccount, tokenContract, tokenDecimals]
  )
  const userVotingSharesNow = usePromise(userVotingSharesNowPromise, [], -1)

  return {
    canExecute,
    canUserVote,
    userBalance,
    userBalancePromise,
    userBalanceNow,
    userBalanceNowPromise,
    userVotingShares,
    userVotingSharesPromise,
    userVotingSharesNow,
    userVotingSharesNowPromise,
    canUserVotePromise,
    canExecutePromise,
  }
}
