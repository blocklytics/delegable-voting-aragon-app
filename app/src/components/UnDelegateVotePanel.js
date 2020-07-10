import React, { useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import {
  Button,
  Field,
  GU,
  Info,
  SidePanel,
  TextInput,
  useSidePanelFocusOnReady,
} from '@aragon/ui'

const UndelegateVotePanel = React.memo(function UndelegateVotePanel({
  panelState,
  onUndelegateVote,
}) {
  return (
    <SidePanel
      title="Undelegate Voting Power"
      opened={panelState.visible}
      onClose={panelState.requestClose}
    >
      <UndelegateVotePanelContent onUndelegateVote={onUndelegateVote} />
    </SidePanel>
  )
})

function UndelegateVotePanelContent({ onUndelegateVote }) {
  const [delegate, setDelegate] = useState('')
  const [delegationAmount, setDelegationAmount] = useState('')

  const inputRef = useSidePanelFocusOnReady()

  const handleSubmit = useCallback(
    event => {
      event.preventDefault()
      onUndelegateVote(delegate.trim(), delegationAmount)
    },
    [onUndelegateVote, delegate, delegationAmount]
  )

  const handleDelegateChange = useCallback(event => {
    setDelegate(event.target.value)
  }, [])

  const handleDelegationAmountChange = useCallback(event => {
    setDelegationAmount(event.target.value)
  }, [])

  return (
    <div>
      <form
        css={`
          margin-top: ${3 * GU}px;
        `}
        onSubmit={handleSubmit}
      >
        <Field label="Delegate address">
          <TextInput
            ref={inputRef}
            value={delegate}
            onChange={handleDelegateChange}
            required
            wide
          />
        </Field>
        <div
          css={`
            margin-bottom: ${3 * GU}px;
          `}
        >
        <Field label="Amount">
          <TextInput
            ref={inputRef}
            value={delegationAmount}
            onChange={handleDelegationAmountChange}
            required
            wide
          />
        </Field>
        <div
          css={`
            margin-bottom: ${3 * GU}px;
          `}
        ></div>
          <Info>
            <ul css={`
                margin-left: 6px;
            `}>
            <li>
            This action will undelegate the amount of voting power you specify from the address you specify.  
            </li>
            <li>
            You must have previously delegated at least this amount of voting power to this address. 
            </li>
            <li>
            Afterwards, you will be able use this voting power yourself or delegate it to another address of your choosing.
            </li>
          </ul>
          </Info>
        </div>
        <Button disabled={!delegate || !delegationAmount} mode="strong" type="submit" wide>
          Undelegate Voting Power
        </Button>
      </form>
    </div>
  )
}

UndelegateVotePanelContent.propTypes = {
  onUndelegateVote: PropTypes.func,
}

UndelegateVotePanelContent.defaultProps = {
  onUndelegateVote: () => {},
}

export default UndelegateVotePanel