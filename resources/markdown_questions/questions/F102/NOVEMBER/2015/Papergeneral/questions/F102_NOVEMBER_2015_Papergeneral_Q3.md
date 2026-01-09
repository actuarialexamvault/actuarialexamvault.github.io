---
subject: 'F102'
session: 'NOVEMBER'
year: '2015'
paper: 'general'
question: 'Q3'
chapters:
  - 'Unit Pricing'
  - 'Risk'
  - 'Modelling'
  - 'Cost of guarantees and options'
  - 'Life Insurance Products'
source_type: 'exam'
time_allocated_minutes: ''
---

## QUESTION 3

i.
Main features:
 The single premium is paid into an investment fund which purchases a number of
units that represent a share of that fund.
 There is usually a range of funds that the policyholder can choose from.
 The total value of an individual policyholder’s fund at any time is the number of units
multiplied by the unit price.
 The value of the units depends on the value of the assets underlying the investment
fund (the unit price will be calculated daily as the value of the assets changes).
 The policyholder’s share (i.e. the number of units) changes when a cashflow relating
to the policy occurs (e.g. deduction of a charge, a switch to another fund, payment on
surrender or maturity).
 The insurance company will deduct charges from the policyholder’s fund. These may
be deducted from the premium before it is invested (e.g. bid/offer spread); or on a
regular basis from the unit funds (e.g. annual fund management charge).
 The charges are kept by the insurer to cover expenses and cost of guarantees.
 The insurer will aim for charges to exceed expenses guarantees, to give profit to the
insurer.
 The value of the policy at maturity is usually the (bid) value of units.
 A surrender penalty may be deducted from the value of the units if the policyholder
withdraws from the contract.
ii
a. Basic equity principle:
 The basic equity principle of unit pricing for an internal fund states that: the interests
of unit holders not involved in a unit transaction should be unaffected by that
transaction.
 For the holder of a unit the only prices relevant are those at which they buy units in
the fund and those at which they redeem units.
 In theory, the movement in price between those two events should only reflect the
performance of the assets backing the unit and charges deductible under the policy
terms.
 Therefore the price of units should not be affected by creation or cancellation of other
units, otherwise cross subsidies between unit holders will arise.

b. Appropriation price:
 The appropriation price is the price at which an insurer will create a unit i.e. the
amount of money that must be put into the fund for the creation of a unit.
 To achieve the basic principle of equity this price per unit is such that the net asset
value per unit is the same before and after the creation of the units.
iii.
Benefits to policyholder:
 The policyholder is protected from the risk that the annuity payment that can be
purchased by the amount in the policyholder unit fund on conversion is lower than the
average monthly payments in the three years prior to the conversion to the level
annuity.
 Since the policyholders are retired and likely to be risk averse, this guarantee is likely
to be appeal to policyholders.
Risks relating to the initial unit-linked retirement income period of the policy:
 Since the policyholder retains the investment risk during the first 10 years of the
policy there is a risk that returns on the unit fund are lower than expected.
 This risk is exacerbated due to the single fund choice.
 There is a risk that the insurer increases the charges, if charges are not guaranteed.
 Both of these risks will reduce the investment fund, resulting in a lower than expected
annuity payment if the expected payment is higher than the guarantee.
Risks relating to the guarantee:
 The initial premium is reduced by a fee for the guaranteed minimum annuity payment
which will reduce the unit fund and subsequently the annuity payments in the first 10
years of the policy.
 The guarantee may be poor value for money from the policyholder’s perspective,
particularly if a high margin for uncertainty is included in the charge for the cost of
the guarantee.
Risks relating to the level annuity:
 Annuity payments are level so inflation is likely to erode the value of the annuity,
resulting in the annuity payment being insufficient to maintain the policyholder’s
standard of living.
 The policy will not provide good value to the policyholder, if he/she dies shortly after
the conversion to the guaranteed level annuity.
General risks:
 Changes in tax legislation could reduce the value of the policy.
 Benefits may be lost or reduced on insolvency of the insurer.
iv.
Modelling the cost of guaranteed annuity:
 The cost of the guarantee is dependent on future investment returns, so a stochastic
model should be used.
 The model will project the values of the unit fund for the 10 year period, by
simulating investment returns and future asset prices, and estimating the annuity
payments to the policyholder (before the conversion date) and charges on the unit
fund.

 Projected annuity rates at conversion will also be modelled using simulated projected
bond yields in the market at the conversion date.
 The probability distribution used to model the investment return and the mean and
variance are key assumptions for this model. These assumptions must be consistent
with the assets mix for the unit fund before the conversion to the level annuity and
market bond yields for the level annuity.
 Assumptions on mortality, withdrawal and expenses will also be needed. These
assumptions would take into account expected experience and will probably be
allowed for on a deterministic basis.
 The model will allow for interaction between the cashflows and all assumptions
should be consistent with each other and allowance should be made for interactions
between assumptions.
 The ‘cost’ of the guarantee is the difference between the value of the unit fund at
conversion and the price of the guaranteed minimum annuity payment using the
projected annuity rates at conversion.
 If the projected fund value exceeds the cost of the guaranteed minimum annuity
payment at the projected market rates then the cost of the guarantee for that particular
scenario is zero.
 If it is less than the cost of the guaranteed minimum annuity payment then the cost of
the guarantee is the difference between the fund value and the cost of the annuity.
 The present value of the cost of the guarantee is determined by discounting the
simulated cost of the guarantee at a suitable rate (i.e. risk discount rate).
 A large number of simulations will be run (5,000 to 10,000 simulations).
 The expected present value of the cost of the guarantee determined by the model will
be the average discounted cost of the guarantee over all simulations.
 The variability of the cost of the guarantee is reflected in the distribution of the
simulated cost of guarantees. This allows one to estimate the cost of the guarantee
with a higher level of confidence (99.5%).
Examiners’ comments
Parts (i) and (ii) were mainly bookwork and were generally well answered, but weaker
candidates gave vague points and failed to link the appropriation price to the equity principle
well.
Part (iii) required some discussion of the risks relating to the cost of the guarantee. Weaker
candidates made too many general points and failed to discuss a sufficient range risks
relating to the altered product.
Candidates who scored well in part (iv) were able to explain the modelling process for
determining the cost of a guarantee in a ordered way. Some candidates gave points relating
to determining the charge for the guarantee which was not required.
