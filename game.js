(() => {
  'use strict';
  const DAYS = 30, START = 10000, START_SATISFACTION = 75;
  const VISIT_MS = 1500, STAGGER_MS = 510, PURCHASE_MS = 840;
  const shoppers = ['👩🏽', '👨🏻', '👩🏼‍🦱', '👨🏾‍🦱', '👩🏻‍🦰', '👨🏼‍🦳'];
  const $ = id => document.getElementById(id);
  const form = $('plan');
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const usd = cents => money.format(cents / 100);
  const cents = id => Math.round($(id).valueAsNumber * 100);
  const tone = value => value < 0 ? 'negative' : value > 0 ? 'positive' : '';
  const varieties = Array.from($('varieties').querySelectorAll('fieldset'), fieldset => {
    const [batchInput, priceInput] = fieldset.querySelectorAll('input');
    return {
      name: fieldset.querySelector('legend').textContent,
      unitCost: Number(fieldset.dataset.unitCost),
      referencePrice: Number(priceInput.defaultValue),
      batchInput,
      priceInput
    };
  });
  let history = [];
  let cash = START;
  let busy = false;
  let satisfaction = START_SATISFACTION;
  const points = value => (value > 0 ? "+" : "") + value;

  function demand(day, price, adSpend, referencePrice, share, random) {
    const weekend = day % 7 === 6 || day % 7 === 0 ? 1.25 : 1;
    const shoppers = 25 + day * 0.55 + 9 * Math.log1p(adSpend / 300);
    const priceEffect = Math.exp(-0.47 * (price / 100 - referencePrice));
    return Math.max(0, Math.round(shoppers * weekend * priceEffect * (0.76 + 0.48 * random) * share));
  }

  function rateSatisfaction(batches, results) {
    const offered = batches.filter(variety => variety.batch > 0);
    const totalBatch = offered.reduce((sum, variety) => sum + variety.batch, 0);
    const interested = results.reduce((sum, variety) => sum + variety.interested, 0);
    const unmet = results.reduce((sum, variety) => sum + variety.interested - variety.sold, 0);
    // Weight price impressions by the menu mix, even when high prices deter all buyers.
    const priceEffect = totalBatch ? Math.round(offered.reduce((sum, variety) =>
      sum + Math.max(-5, Math.min(5, 10 * (1 - variety.price / (variety.referencePrice * 100)))) *
        variety.batch / totalBatch, 0)) : 0;
    const inventoryEffect = !totalBatch ? -10 : unmet ? -Math.ceil(10 * unmet / interested) : interested ? 2 : 0;
    const next = Math.max(0, Math.min(100, satisfaction + priceEffect + inventoryEffect));
    const priceReason = !totalBatch ? 'No cookies on the menu; no price effect'
      : priceEffect > 0 ? 'Prices below the starting prices pleased customers'
      : priceEffect < 0 ? 'Prices above the starting prices disappointed customers'
      : 'Prices were close to the starting prices overall';
    const inventoryReason = !totalBatch ? 'No cookies baked; customers found an empty shop'
      : unmet ? unmet + ' of ' + interested + ' requested cookies were unavailable'
      : interested ? 'All ' + interested + ' requested cookies were available'
      : 'No demand today; no inventory effect';
    return {
      score: next,
      change: next - satisfaction,
      explanation: priceReason + ' (' + points(priceEffect) + ' points). ' + inventoryReason +
        ' (' + points(inventoryEffect) + ' points).' +
        (next !== satisfaction + priceEffect + inventoryEffect ? ' Score limited to the 0–100 range.' : '')
    };
  }

  function readPlan() {
    const batches = varieties.map(variety => ({
      name: variety.name,
      batch: variety.batchInput.valueAsNumber,
      price: Math.round(variety.priceInput.valueAsNumber * 100),
      referencePrice: variety.referencePrice,
      bakingCost: variety.batchInput.valueAsNumber * variety.unitCost
    }));
    const ads = cents('ads');
    const expenses = batches.reduce((total, variety) => total + variety.bakingCost, ads);
    return { batches, ads, expenses };
  }

  function updatePlan() {
    const { expenses: cost } = readPlan();
    const valid = form.checkValidity();
    const over = valid && cost > cash;
    $('cost').textContent = Number.isFinite(cost) && cost >= 0 ? usd(cost) : '—';
    $('error').hidden = !over;
    $('error').textContent = over ? 'This plan costs ' + usd(cost - cash) + ' more than you have. Reduce your batch or ad spend.' : '';
    $('open').disabled = busy || over;
  }

  function animateSales(sold, closeShop) {
    if (!sold || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeShop();
      return;
    }

    const count = Math.min(6, Math.ceil(sold / 6));
    let soldSoFar = 0;
    $('soldLive').textContent = '0';
    $('empty').hidden = true;
    $('receipt').hidden = true;
    $('varietySales').hidden = true;
    $('shopFloor').hidden = false;
    $('satisfactionReport').hidden = true;

    for (let i = 0; i < count; i++) {
      const quantity = Math.floor(sold / count) + (i < sold % count ? 1 : 0);
      const delay = i * STAGGER_MS;
      const customer = document.createElement('div');
      customer.className = 'customer';
      customer.style.setProperty('--delay', delay + 'ms');
      customer.textContent = shoppers[(history.length + i) % shoppers.length];
      const order = document.createElement('span');
      order.className = 'order';
      order.textContent = '🍪 × ' + quantity;
      customer.append(order);
      $('customers').append(customer);
      window.setTimeout(() => {
        soldSoFar += quantity;
        $('soldLive').textContent = soldSoFar;
      }, delay + PURCHASE_MS);
    }

    window.setTimeout(() => {
      $('shopFloor').hidden = true;
      $('customers').replaceChildren();
      closeShop();
    }, (count - 1) * STAGGER_MS + VISIT_MS);
  }

  function showReceipt(result) {
    $('empty').hidden = Boolean(result);
    $('receipt').hidden = !result;
    $('satisfactionReport').hidden = !result;
    $('result-sub').textContent = result
      ? 'Day ' + result.day + ' closed · ' + (result.batch - result.sold) + ' unsold'
      : 'Your sales and costs, counted at closing time.';
    $('varietySales').hidden = !result || !result.varietyResults.length;
    if (!result) {
      $('varietyRows').replaceChildren();
      return;
    }
    $('varietyRows').replaceChildren(...result.varietyResults.map(variety => {
      const row = document.createElement('tr');
      [variety.name, variety.sold + ' / ' + variety.batch, usd(variety.revenue)].forEach(value => {
        row.insertCell().textContent = value;
      });
      return row;
    }));
    $('satisfactionChange').textContent = result.satisfaction.score + '/100 (' + points(result.satisfaction.change) + ' points today)';
    $('satisfactionReason').textContent = result.satisfaction.explanation;
    $('sold').textContent = result.sold + ' of ' + result.batch;
    $('revenue').textContent = usd(result.revenue);
    $('expenses').textContent = usd(result.expenses);
    $('dailyProfit').textContent = usd(result.profit);
    $('dailyProfit').className = tone(result.profit);
    $('remaining').textContent = usd(result.cash);
  }

  function render() {
    const done = history.length === DAYS;
    const day = history.length + 1;
    $('cash').textContent = usd(cash);
    $('satisfaction').textContent = satisfaction + '/100';
    $('profit').textContent = usd(cash - START);
    $('profit').className = tone(cash - START);
    $('day').textContent = done ? '30 of 30 complete' : 'Day ' + day + ' of ' + DAYS;
    $('progress').value = history.length;
    $('open').textContent = 'Open shop for Day ' + day + ' →';
    $('reset').disabled = history.length === 0;
    form.hidden = done;
    $('finish').hidden = !done;
    $('outcome').textContent = done
      ? 'You finished with ' + usd(cash) + ' in cash and a net ' +
        (cash < START ? 'loss of ' : 'profit of ') + usd(Math.abs(cash - START)) + '.'
      : '';
    $('count').textContent = '· ' + history.length + (history.length === 1 ? ' day' : ' days');
    $('noHistory').hidden = history.length > 0;
    $('history').hidden = history.length === 0;
    $('rows').replaceChildren(...history.slice().reverse().map(entry => {
      const row = document.createElement('tr');
      [entry.day, entry.sold + ' / ' + entry.batch, usd(entry.revenue), usd(entry.expenses),
        usd(entry.profit), usd(entry.cash), entry.satisfaction.score + '/100 (' + points(entry.satisfaction.change) + ')',
        entry.satisfaction.explanation].forEach((value, index) => {
        const cell = row.insertCell();
        cell.textContent = value;
        if (index === 4) cell.className = tone(entry.profit);
        if (index === 7) cell.className = 'history-reason';
      });
      return row;
    }));
    showReceipt(history.at(-1));
    updatePlan();
  }

  form.addEventListener('input', updatePlan);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy || history.length >= DAYS || !form.reportValidity()) return;
    const day = history.length + 1;
    const { batches, ads, expenses } = readPlan();
    if (expenses > cash) return;
    const batch = batches.reduce((total, variety) => total + variety.batch, 0);
    const trafficVariation = Math.random();
    const varietyResults = batches.filter(variety => variety.batch > 0).map(variety => {
      const share = variety.batch / batch;
      const interested = demand(day, variety.price, ads, variety.referencePrice, share, trafficVariation);
      const sold = Math.min(variety.batch, interested);
      return { name: variety.name, batch: variety.batch, interested, sold, revenue: sold * variety.price };
    });
    const sold = varietyResults.reduce((total, variety) => total + variety.sold, 0);
    const revenue = varietyResults.reduce((total, variety) => total + variety.revenue, 0);
    const profit = revenue - expenses;
    const dailySatisfaction = rateSatisfaction(batches, varietyResults);
    busy = true;
    $('open').textContent = 'Shop is open…';
    $('reset').disabled = true;
    $('result-sub').textContent = 'Day ' + day + ' · Shop is open';
    $('announcement').textContent = 'Day ' + day + ' is open.';
    updatePlan();
    animateSales(sold, () => {
      cash += profit;
      satisfaction = dailySatisfaction.score;
      history.push({ day, batch, sold, revenue, expenses, profit, cash, varietyResults, satisfaction: dailySatisfaction });
      busy = false;
      render();
      $('announcement').textContent = 'Day ' + day + ' closed. Sold ' + sold + ' cookies. Profit ' +
        usd(profit) + '. Remaining cash ' + usd(cash) + '. Satisfaction ' + satisfaction + '/100, ' + points(dailySatisfaction.change) + ' points. ' +
        dailySatisfaction.explanation + (day === DAYS ? ' Challenge complete.' : '');
      if (day === DAYS) $('reset').focus();
    });
  });

  $('reset').addEventListener('click', () => {
    if (busy || !window.confirm('Start over with $100? Your current sales history will be cleared.')) return;
    history = [];
    cash = START;
    satisfaction = START_SATISFACTION;
    form.reset();
    render();
    $('announcement').textContent = 'New game started. Day 1, with $100 in cash.';
    $('batch').focus();
  });
  render();
})();
