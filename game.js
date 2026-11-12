(() => {
  'use strict';
  const DAYS = 30, START = 10000, UNIT_COST = 50;
  const VISIT_MS = 1500, STAGGER_MS = 510, PURCHASE_MS = 840;
  const shoppers = ['👩🏽', '👨🏻', '👩🏼‍🦱', '👨🏾‍🦱', '👩🏻‍🦰', '👨🏼‍🦳'];
  const $ = id => document.getElementById(id);
  const form = $('plan');
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const usd = cents => money.format(cents / 100);
  const cents = id => Math.round($(id).valueAsNumber * 100);
  const tone = value => value < 0 ? 'negative' : value > 0 ? 'positive' : '';
  let history = [];
  let cash = START;
  let busy = false;

  function demand(day, price, adSpend, random = Math.random()) {
    const weekend = day % 7 === 6 || day % 7 === 0 ? 1.25 : 1;
    const shoppers = 25 + day * 0.55 + 9 * Math.log1p(adSpend / 300);
    const priceEffect = Math.exp(-0.47 * (price / 100 - 2));
    return Math.max(0, Math.round(shoppers * weekend * priceEffect * (0.76 + 0.48 * random)));
  }

  function updatePlan() {
    const cost = $('batch').valueAsNumber * UNIT_COST + cents('ads');
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
    $('shopFloor').hidden = false;

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
    $('result-sub').textContent = result
      ? 'Day ' + result.day + ' closed · ' + (result.batch - result.sold) + ' unsold'
      : 'Your sales and costs, counted at closing time.';
    if (!result) return;
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
        usd(entry.profit), usd(entry.cash)].forEach((value, index) => {
        const cell = row.insertCell();
        cell.textContent = value;
        if (index === 4) cell.className = tone(entry.profit);
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
    const day = history.length + 1, batch = $('batch').valueAsNumber;
    const price = cents('price'), ads = cents('ads');
    const expenses = batch * UNIT_COST + ads;
    if (expenses > cash) return;
    const sold = Math.min(batch, demand(day, price, ads));
    const revenue = sold * price;
    const profit = revenue - expenses;
    busy = true;
    $('open').textContent = 'Shop is open…';
    $('reset').disabled = true;
    $('result-sub').textContent = 'Day ' + day + ' · Shop is open';
    $('announcement').textContent = 'Day ' + day + ' is open.';
    updatePlan();
    animateSales(sold, () => {
      cash += profit;
      history.push({ day, batch, sold, revenue, expenses, profit, cash });
      busy = false;
      render();
      $('announcement').textContent = 'Day ' + day + ' closed. Sold ' + sold + ' cookies. Profit ' +
        usd(profit) + '. Remaining cash ' + usd(cash) + '.' + (day === DAYS ? ' Challenge complete.' : '');
      if (day === DAYS) $('reset').focus();
    });
  });

  $('reset').addEventListener('click', () => {
    if (busy || !window.confirm('Start over with $100? Your current sales history will be cleared.')) return;
    history = [];
    cash = START;
    form.reset();
    render();
    $('announcement').textContent = 'New game started. Day 1, with $100 in cash.';
    $('batch').focus();
  });
  render();
})();
