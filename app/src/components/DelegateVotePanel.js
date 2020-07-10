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

const DelegateVotePanel = React.memo(function DelegateVotePanel({
  panelState,
  onDelegateVote,
}) {
  return (
    <SidePanel
      title="Delegate Voting Power"
      opened={panelState.visible}
      onClose={panelState.requestClose}
    >
      <DelegateVotePanelContent onDelegateVote={onDelegateVote} />
    </SidePanel>
  )
})

function DelegateVotePanelContent({ onDelegateVote }) {
  const [delegate, setDelegate] = useState('')
  const [delegationAmount, setDelegationAmount] = useState('')

  const inputRef = useSidePanelFocusOnReady()

  const handleSubmit = useCallback(
    event => {
      event.preventDefault()
      onDelegateVote(delegate.trim(), delegationAmount)
    },
    [onDelegateVote, delegate, delegationAmount]
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
            This action will delegate 'amount' of voting power to the address you specify.  
            </li>
            <li>
            This delegate will then be able to vote with their voting power + your voting power until you choose to undelegate this power from them. 
            </li>
            <li>
            You will not be able to use this voting power yourself or delegate it to another address until you first undelegate it.
            </li>
            </ul>
          </Info>
        </div>
        <Button disabled={!delegate || !delegationAmount} mode="strong" type="submit" wide>
          Delegate Voting Power
        </Button>
      </form>
    </div>
  )
}

DelegateVotePanelContent.propTypes = {
  onDelegateVote: PropTypes.func,
}

DelegateVotePanelContent.defaultProps = {
  onDelegateVote: () => {},
}

export default DelegateVotePanel
