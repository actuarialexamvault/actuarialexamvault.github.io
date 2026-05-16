"""One-off script: merge '19. Further risk management' summary into '5. Risks'."""
import json
from pathlib import Path

RESULTS = Path(__file__).parent / "results"

MERGED_HTML = """<h3>What You Must Know</h3>
<p>This topic covers the full spectrum of risks faced by life insurance companies — their sources, interactions, and practical management. It spans risk identification (model, parameter, and operational risks across mortality, investment, expense, and withdrawal dimensions) through to hands-on management techniques including expense control, persistency management, new business monitoring, and options/guarantee management. This is a high-frequency exam area because it underpins all actuarial work in pricing, reserving, and capital management.</p>

<h3>Core Concepts</h3>

<h4>Sources of Risk for Life Insurers</h4>
<ul>
  <li>Policy and other data: Inaccurate or incomplete data can lead to mispricing, inadequate reserving, and poor decision-making.</li>
  <li>Mortality and morbidity: Uncertainty in death, illness, or disability rates affects claims and reserves.</li>
  <li>Investment performance: Variability in asset returns, mismatching, and market volatility impact the ability to meet guarantees and liabilities.</li>
  <li>Expenses and inflation: Actual expenses may exceed assumptions due to inflation, inefficiency, or business volume changes.</li>
  <li>Withdrawals (lapses, surrenders): Policyholder behaviour can deviate from assumptions, affecting income, expenses, and risk exposure.</li>
  <li>Mix of new business: Changes in product type, size, or distribution channel alter risk and profitability profiles.</li>
  <li>Volume of business: Too high or too low volumes create capital strain or threaten expense recovery and viability.</li>
  <li>Guarantees and options: Embedded product features introduce additional risk and capital strain.</li>
  <li>Strategic, operational, legal, regulatory, and counterparty risks: External and internal factors can disrupt operations or financial stability.</li>
</ul>

<h4>Data Risks</h4>
<ul>
  <li>Quality, completeness, and accuracy of policy data are critical for reliable actuarial work.</li>
  <li>Model point representation and model risk: Simplifications may misrepresent the business.</li>
  <li>Credibility, relevance, and quality of data used for assumption setting are often limited, especially for new or niche products.</li>
  <li>Health and care products face severe data limitations due to low volumes and heterogeneity.</li>
</ul>

<h4>Mortality and Morbidity Risks</h4>
<ul>
  <li>Model risk: The chosen statistical model may not reflect reality (e.g., assuming i.i.d. lives).</li>
  <li>Parameter risk: Estimated rates may not match actual experience.</li>
  <li>Random fluctuations: Especially significant in small portfolios.</li>
  <li>Direction of risk: Higher mortality is a risk for life cover; longevity is a risk for annuities.</li>
  <li>Selection risks: Anti-selection and selective withdrawals can worsen experience.</li>
  <li>Health and care products: Risks focus on claim incidence and recovery rates, compounded by data limitations.</li>
</ul>

<h4>Investment Risks</h4>
<ul>
  <li>Model, parameter, and random fluctuation risks apply to investment returns.</li>
  <li>Mismatching risk: Asset-liability duration mismatch leads to reinvestment or capital value risks.</li>
  <li>Investment guarantees: Risk that assets underperform relative to guaranteed benefits.</li>
</ul>

<h4>Expense, Inflation &amp; Cost Control</h4>
<ul>
  <li>Expense risk arises from actual expenses exceeding assumptions due to inflation, inefficiency, or business volume changes; inflation risk can erode margins, especially for level premium products.</li>
  <li>Expense risk is linked to new business mix, withdrawal rates, and investment performance (for unit-linked charges).</li>
  <li>Expense control aims to keep actual expenses and commissions within premium loadings; insurers monitor by category (initial, renewal, investment) and benchmark against competitors.</li>
  <li>Methods to control expenses: increasing volumes to spread fixed costs, automation and process improvements, cheaper distribution channels, and managing staff costs.</li>
  <li>Commissions are controlled at product line, distribution channel, and individual salesperson/broker level — increases often start at the individual level and must be caught early.</li>
  <li>To manage mismatches between expense incidence and loadings, insurers may reprice products, alter product mix, change distribution channels, or adjust minimum premiums.</li>
</ul>

<h4>Withdrawal, Persistency &amp; Retention</h4>
<ul>
  <li>Model, parameter, and random fluctuation risks in predicting lapses, surrenders, and paid-up rates.</li>
  <li>Withdrawals affect mortality and expense assumptions through selective behaviour and fixed cost spreading; incorrect assumptions lead to immediate losses from unrecovered acquisition costs.</li>
  <li>Persistency rates are monitored by distribution channel and salesperson/broker, with pricing and valuation assumptions updated as experience evolves.</li>
  <li>Improving persistency: aligning sales incentives (lower initial, higher renewal commissions, clawbacks), financial underwriting, and addressing root causes (customer service, payment methods, product design, staff training).</li>
  <li>Product features that help reduce lapses: premium holidays, capping premium increases, fair alteration terms, and surrender penalties.</li>
</ul>

<h4>Mix, Volume &amp; New Business Strain</h4>
<ul>
  <li>Mix by nature, size, and source affects capital requirements, expense recovery, and risk profile.</li>
  <li>Too high volumes: Capital strain, operational overload, and potential solvency issues. Too low volumes: Failure to recover fixed costs, loss of competitiveness, and long-term viability threats.</li>
  <li>New business strain arises from acquisition expenses, capital requirements, and mismatches between income and outgo; managed through less onerous product design (unit-linked, reviewable premiums, reduced guarantees).</li>
  <li>Monitoring is done by product line and distribution channel, tracking contract numbers and premium amounts.</li>
  <li>Insurers must ensure sufficient capital and administrative resources to support planned growth in new business volumes.</li>
</ul>

<h4>Options, Guarantees &amp; Their Management</h4>
<ul>
  <li>Mortality/morbidity and investment guarantees introduce anti-selection, capital strain, and model/parameter risks.</li>
  <li>Options (surrender, premium holidays, guaranteed insurability) increase uncertainty and potential for adverse selection.</li>
  <li>Insurers monitor the cost of options and guarantees against loadings, adjusting charges or product design if losses emerge.</li>
  <li>Benefits of options (marketability, customer need) must be weighed against costs (actual/potential losses, risk exposure).</li>
  <li>Mitigation: prudent reserving, hedging with financial derivatives, buying back options from policyholders, or restructuring product design.</li>
  <li>Changes to options/guarantees are easier for new business; for in-force policies, strict policy wording and fair policyholder treatment are required.</li>
</ul>

<h4>Strategic, Operational &amp; Counterparty Risks</h4>
<ul>
  <li>Strategic risk: Board decisions may conflict with actuarial advice or policyholder interests.</li>
  <li>Operational risk: Failures in management systems, controls, or fraud can cause financial loss.</li>
  <li>Counterparty risk: Reinsurer, outsourcer, or investment default exposes the insurer to loss.</li>
  <li>Legal, regulatory, and fiscal risks: Changes or non-compliance can have severe financial and reputational impacts.</li>
</ul>

<h4>Aggregation &amp; Concentration of Risk</h4>
<ul>
  <li>Risks must be considered in aggregate, allowing for correlations and interactions (e.g., via stochastic modelling).</li>
  <li>Concentration risk arises from large exposures or non-independent risks (e.g., catastrophe, asset over-concentration).</li>
  <li>Credit rating downgrades can restrict business and increase lapse risk.</li>
</ul>

<h4>Risks from Distributors</h4>
<ul>
  <li>Distributors can drive lapses, exploit product features, create credit risk, or cause mis-selling and legal issues.</li>
</ul>

<h4>Risk Management Framework &amp; Actuary's Role</h4>
<ul>
  <li>Risk must be measured relative to company aims, capital, and regulatory requirements; strategic decisions balance risk and return.</li>
  <li>Actuaries regularly advise directors on the nature, size, and management of risks, including scenario modelling for sensitive risks.</li>
  <li>They document, implement, and monitor risk management strategies, supporting an enterprise risk management (ERM) approach that captures aggregate risk and diversification benefits.</li>
</ul>

<h3>Examiner Angles — What They Actually Test</h3>
<p>Based on past exam questions, the examiner consistently focuses on:</p>
<ul>
  <li><strong>Product-specific risk analysis</strong> — Identifying and explaining the main risks (mortality, morbidity, investment, expense, withdrawal) for a given product design, including new features or changes.</li>
  <li><strong>Impact of product changes</strong> — Assessing how new guarantees, options, or changes in charging structure increase risk and how these can be managed.</li>
  <li><strong>Expense and persistency risk linkage</strong> — Explaining how lapses/withdrawals affect expense recovery and overall profitability.</li>
  <li><strong>Expense and commission management</strong> — Discussing how to monitor and control expenses and commissions at multiple organisational levels, and the impact of distribution channel choice.</li>
  <li><strong>Managing persistency and policyholder behaviour</strong> — Suggesting ways to improve persistency and reduce lapses, including incentive structures and product design features.</li>
  <li><strong>Investment risk and mismatching</strong> — Discussing risks from asset-liability mismatches, especially with guarantees or overseas investments.</li>
  <li><strong>Options and guarantees risk management</strong> — Identifying risks from product features and outlining methods to monitor, price, and mitigate these risks.</li>
  <li><strong>Managing new business strain and capital requirements</strong> — Explaining how product design and business mix affect capital strain and how to manage it.</li>
  <li><strong>Risk mitigation strategies</strong> — Proposing practical measures: product design changes, underwriting, reinsurance, reserving, and monitoring actual vs. expected experience.</li>
  <li><strong>Operational and counterparty risks</strong> — Recognising risks from outsourcing, administration, or distributor actions.</li>
  <li><strong>Strategic and regulatory risks</strong> — Identifying risks from regulatory changes, compliance, or strategic decisions.</li>
</ul>

<h3>Common Pitfalls &amp; Exam Technique</h3>
<ul>
  <li>Omitting less obvious risks (data, operational, counterparty, regulatory) when asked for a comprehensive risk analysis.</li>
  <li>Failing to link risks to specific product features or changes (e.g., how a new guarantee increases investment risk).</li>
  <li>Not distinguishing between model, parameter, and random fluctuation risks for mortality, investment, or withdrawal assumptions.</li>
  <li>Overlooking the dynamic links between risks (e.g., how lapses affect expense and mortality risk).</li>
  <li>Omitting discussion of both expense and commission control, or failing to address monitoring at multiple organisational levels.</li>
  <li>Not linking risk mitigation strategies to the specific product or risk in question — generic answers score poorly.</li>
  <li>Ignoring the challenges in setting assumptions for new products, such as lack of credible data or differences from existing products.</li>
  <li>Forgetting to mention the impact of distribution channel on expenses, persistency, and anti-selection risk.</li>
  <li>Neglecting to discuss both the benefits and costs of options/guarantees, or the time lag in risk mitigation for in-force business.</li>
  <li>Not addressing both the direction and magnitude of risk (e.g., higher mortality vs. longevity risk for different products).</li>
  <li>Failing to consider capital and administrative resource constraints when discussing new business growth.</li>
  <li>Not referencing the actuary's ongoing role in risk identification, quantification, and communication to management.</li>
  <li>In "outline" questions, writing too much detail or missing breadth — use concise, well-structured bullet points covering all relevant angles.</li>
</ul>"""

data = json.loads((RESULTS / "topic_summaries.json").read_text(encoding="utf-8"))
data["5. Risks"]["summary_html"] = MERGED_HTML
# Remove the now-merged standalone topic
data.pop("19. Further risk management", None)
(RESULTS / "topic_summaries.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("Done. Keys remaining:", len(data))
for k in data:
    print(" ", k)
