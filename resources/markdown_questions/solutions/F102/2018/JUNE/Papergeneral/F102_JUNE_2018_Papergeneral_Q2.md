---
subject: 'F102'
session: 'JUNE'
year: '2018'
paper: 'general'
question: 'Q2'
chapters:
  - 'Reinsurance'
source_type: 'examiners_report'
time_allocated_minutes: ''
---

## QUESTION 2

i. A retention limit is the maximum amount of risk retained by the cedant on any individual
risk. Beyond the retention limit, the insurer cedes the excess risk to a reinsurer.
The general factors to take into account when setting the retention limit include:

- The average benefit level for the product.

- The expected distribution of the benefit amounts.

- The company's insurance risk appetite.

- The level of the company's free assets and the importance attached to stability of its free asset ratio.

- The terms on which reinsurance can be obtained and the dependence of such terms on the retention limit.

- The level of familiarity of the company with underwriting the type of business involved.

- The effect on the company's regulatory capital requirements of increasing or reducing the retention limit.

- The existence of a profit-sharing arrangement in the reinsurance treaty.

- The company's retention limits on its other products.

- The nature of any future increases in sums assured.

ii. Set the retention limit at such a level as to keep the probability of insolvency (or ruin
probability) below a specified level. An alternative approach is to aim for a probability that the loss in any one quarter or year does not exceed a proportion of the earnings of the business, if that is how the cedant determines its risk appetite.
This can be done by using a stochastic model for projecting claim rates and a model of the business, so that claims can be projected forward together with the value of the company's assets and liabilities. By using simulation, a retention level can then be determined such that the company stays solvent, or earnings stay above a certain level, for 995, say, out of 1000 runs.
Summarising the procedure for determining suitable retention limits:
1. Decide on some criterion for claims volatility beyond which the company cannot
go. For example, you might want to have only a 1% chance that the net loss from claims is at least R25m.
2. For differing retention limits, having sounded out reinsurers on terms available for
your business, model the function "{total claims net of reinsurance} less {total risk premiums net of reinsured risk premiums}". This modelling will be done stochastically, varying the mortality experience.
3. The function is therefore:

C(r) = claims recovered from reinsurer P(g) = risk premium available (from policy) to insurer P(r) = risk premium paid to reinsurer The criterion would therefore be that Pr(X >25m)=0.01 .
4. Look at the results of this modelling to choose the retention limit that will satisfy
your criterion.
iii. To obtain the optimal balance between reinsurance and a mortality fluctuation reserve we
might assume that some of the cost of the risk premium reinsurance is instead going to be spent on financing a mortality fluctuation reserve.
The cost of holding a reserve of size M is equal to: M(j- i) where j is the expected rate of return from the company's capital, and i is the expected rate of return from the assets that will back the reserve.

This follows from the fact that, by tying up capital in a mortality fluctuation reserve, the company is unable to use that capital to finance other ventures, from which it would have expected to earn a return of j. Instead, it will earn an expected return of i, hence the difference is the cost (i.e. loss of expected return) to the company over one year.
If we decide to redirect, say, x% of the reinsurance risk premium to the mortality fluctuations reserve, then the amount of mortality reserve purchased (for one year) is: M = (x/100) P(r) / (j - i) We now have only (1 - x/100)P(r) left with which to buy reinsurance, so we will have to have a higher retention level in order for the cost to be only (1 - x/100)P(r).

Hence we have been able to exchange reinsurance for a mortality fluctuation reserve, at parity of cost.
We can now model the distribution of X under this new arrangement, noting that we now have a higher retention level (so the claims recoveries from the reinsurer will be lower) and X is now calculated as: X =[C(g)- C¢(r)]- [P(g)- P(r)]- M =[C(g)- C¢(r)]- P(g)- 29P(r) where C¢(r) is the claims recovered from the reinsurer at the new level of retention.

Compare the protection offered under this new construction against that offered by the previous arrangement, i.e. recalculate Pr(X 25m).
If this probability is less than the 1% previously obtained, then using a mortality fluctuation reserve (to the extent assumed) is cheaper than using reinsurance, and would therefore be the preferred strategy.

We can then try this for other levels of reinsurance and mortality fluctuation reserve. Then we can decide on which combination offers the most protection for a given cost.
If the degree of protection is increased by the use of a mortality fluctuation reserve, then we can determine (probably by trial and error) the actual amounts of mortality fluctuation reserve and retention level that are necessary to meet our desired ruin criterion, with lowest cost to the insurer.
Part (i) was bookwork and was generally well answered by prepared candidates.
Part (ii) was reasonably well answered by the better prepared candidates. However, some candidates provided too much detail for 4 marks and wasted time giving detail on points that were not necessary. A number of candidates focussed on model points and outlined general asset-liability modelling, which was not appropriate for the question.
Part (iii) was poorly answered by most candidates. The majority of candidates did not appear to know what a mortality fluctuation reserve is, and many thought that one simply replaces reinsurance with a mortality fluctuation reserve and did not attempt to explain how to combine such a reserve with reinsurance to obtain the optimal balance.
