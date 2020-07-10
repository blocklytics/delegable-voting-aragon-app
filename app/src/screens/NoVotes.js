import React from 'react'
import { Box, Button, EmptyStateCard, GU, LoadingRing, textStyle } from '@aragon/ui'
import noVotesPng from '../assets/no-votes.png'

const NoVotes = React.memo(function NoVotes({ onNewVote, onDelegateVote, onUndelegateVote, isSyncing }) {
  return (
    <React.Fragment>
      <div
        css={`
        display: block;
        width: 100%;
        text-align: center;
    ` }
    >
      <div
        css={`
          ${textStyle('title2')};
          display: block;
          width: 100%;
          text-align: center;
          padding: 30px;
      ` }
      >
        What would you like to do?
      </div>
      <div
        css={`
          display: flex;
          flex-flow: row wrap;
          align-items: center;
          align-content: space-between;
          justify-content: space-evenly;
          grid-template-columns: auto auto;
      `}
      >
      <EmptyStateCard
        text={
          isSyncing ? (
            <div
              css={`
                display: grid;
                align-items: center;
                justify-content: center;
                grid-template-columns: auto auto;
              `}
            >
              <LoadingRing />
              <span>Syncing…</span>
            </div>
          ) : (
            'Create a new vote!'
          )
        }
        action={
          <Button wide mode="strong" onClick={onNewVote}>
            Create New Vote
          </Button>
        }
        illustration={
          <img
            css={`
              margin: auto;
              height: 170px;
            `}
            src={noVotesPng}
            alt="Create new vote"
          />
        }
      />
      <EmptyStateCard
        text={
          isSyncing ? (
            <div
              css={`
                display: grid;
                align-items: center;
                justify-content: center;
                grid-template-columns: auto auto;
              `}
            >
              <LoadingRing />
              <span>Syncing…</span>
            </div>
          ) : (
            'Delegate voting power!'
          )
        }
        action={
          <Button wide mode="strong" onClick={onDelegateVote}>
            Delegate Vote
          </Button>
        }
        illustration={
          <img
            css={`
              margin: auto;
              height: 170px;
            `}
            src={noVotesPng}
            alt="Delegate voting power"
          />
        }
      />
      <EmptyStateCard
        text={
          isSyncing ? (
            <div
              css={`
                display: grid;
                align-items: center;
                justify-content: center;
                grid-template-columns: auto auto;
              `}
            >
              <LoadingRing />
              <span>Syncing…</span>
            </div>
          ) : (
            'Undelegate voting power!'
          )
        }
        action={
          <Button wide mode="strong" onClick={onUndelegateVote}>
            Undelegate Vote
          </Button>
        }
        illustration={
          <img
            css={`
              margin: auto;
              height: 170px;
            `}
            src={noVotesPng}
            alt="Undelegate voting power"
          />
        }
      />
      </div>
      </div>
    </React.Fragment>
  )
})

export default NoVotes
