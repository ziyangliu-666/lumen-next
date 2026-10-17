/* The session page. The markup holds one project, Pop-stack fertility. The
   other projects on home, and a project just started from a form, are
   drawn here from the data below, so every link in the prototype opens a
   page that matches what home said about it. */
(function () {
  var $ = function (s) {
    return document.querySelector(s);
  };
  var log = $('[data-log]');

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function turn(who, html) {
    var a = document.createElement('article');
    a.className = who === 'You' ? 'turn turn-you' : 'turn';
    a.innerHTML = '<h2 class="who">' + who + '</h2><div class="turn-body">' + html + '</div>';
    // New turns go above the bottom fade, which stays the last child.
    var edge = log.querySelector('.edge-bottom');
    if (edge) edge.before(a);
    else log.appendChild(a);
    return a;
  }
  function step(kind, meta, inner) {
    return (
      '<section class="step"><h3 class="step-kind">' +
      kind +
      (meta ? ' <span class="num">' + meta + '</span>' : '') +
      '</h3>' +
      inner +
      '</section>'
    );
  }
  function thought(t) {
    return '<p class="thought">' + t + '</p>';
  }
  function work(steps) {
    return '<div class="work">' + steps.join('') + '</div>';
  }
  var V = {
    confirmed: '<span class="verdict v-confirmed">Confirmed</span>',
    open: '<span class="verdict v-open">Open question</span>',
    dropped: '<span class="verdict v-dropped">Dropped</span>',
  };
  function finding(claim, v, ev) {
    return (
      '<li' +
      (v === 'dropped' ? ' class="find-dropped"' : '') +
      '><div class="find-head"><p class="find-claim">' +
      claim +
      '</p>' +
      V[v] +
      '</div><p class="find-ev">' +
      ev +
      '</p></li>'
    );
  }
  function setRun(cls, label) {
    var el = $('[data-state]');
    el.className = 'run' + (cls ? ' ' + cls : '');
    el.textContent = label;
  }

  var PROJECTS = {
    inversion: {
      title: 'Inversion sequences avoiding two patterns',
      run: ['run-wait', 'Waiting on you'],
      spend: '$0.18',
      age: 'waiting for 2 h',
      draw: function () {
        turn(
          'You',
          '<p class="say">Count inversion sequences that avoid both 011 and 201, and find out whether the counts are known.</p>',
        );
        turn(
          'lumen',
          work([
            step(
              'Searched',
              '4 s, $0.01',
              '<ul class="rows"><li><span class="row-src">OEIS</span><span class="row-q">the counts for n&nbsp;≤&nbsp;12</span><span class="row-res">No match</span></li><li><span class="row-src">arXiv</span><span class="row-q">inversion sequences, pattern avoidance</span><span class="row-res num">12 papers</span></li></ul>',
            ),
            step(
              'Ran',
              '6 min 10 s',
              '<pre class="term num">$ python invseq.py --avoid 011,201 --to 12\nn = 12   counts agree with no OEIS entry</pre>',
            ),
            step(
              'Recorded 1 finding',
              '',
              '<ul class="rows rows-finds"><li><span class="row-q">Counts to n&nbsp;=&nbsp;12 match no OEIS sequence</span>' +
                V.open +
                '</li></ul>',
            ),
          ]) +
            '<p class="reply">The counts to n&nbsp;=&nbsp;12 match no sequence in the OEIS. Two more terms would let me test a generating function, but n&nbsp;=&nbsp;14 needs about 40 minutes of compute.</p>' +
            '<div class="ask" data-ask><p><b>Spend about $2.40 more to extend the count to n&nbsp;=&nbsp;14?</b></p><div class="ask-actions"><button type="button" class="btn btn-solid" data-approve>Approve $2.40</button><button type="button" class="btn" data-decline>Not now</button></div></div>',
        );
        return {
          finds: [
            finding(
              'Counts to n&nbsp;=&nbsp;12 match no OEIS sequence',
              'open',
              'Searched the first twelve terms. No entry matches.',
            ),
          ],
          tree: [['lead', 'run-wait', 'Waiting on you']],
          files: ['code/invseq.py', 'results/invseq_n12.csv'],
        };
      },
    },
    pinnacle: {
      title: 'Pinnacle sets of permutations',
      run: ['', 'Finished'],
      spend: '$0.31',
      age: 'ended yesterday, ran 1 h 05 min',
      ended: true,
      draw: function () {
        turn(
          'You',
          '<p class="say">Check the closed form for the number of pinnacle sets, and push it as far as it goes.</p>',
        );
        turn(
          'lumen',
          work([
            step(
              'Ran',
              '41 s',
              '<pre class="term num">$ python pinnacle.py --to 12\nclosed form holds for every n up to 12</pre>',
            ),
            step(
              'Recorded 2 findings',
              '',
              '<ul class="rows rows-finds"><li><span class="row-q">The closed form holds to n&nbsp;=&nbsp;12</span>' +
                V.confirmed +
                '</li><li><span class="row-q">A generating function for the refined count</span>' +
                V.open +
                '</li></ul>',
            ),
          ]) +
            '<p class="reply">The closed form holds to n&nbsp;=&nbsp;12. I could not find a generating function for the count refined by the largest pinnacle, so I left that as an open question and stopped.</p>',
        );
        return {
          finds: [
            finding(
              'A generating function for the refined count',
              'open',
              'No candidate fits the refined counts to n&nbsp;=&nbsp;12.',
            ),
            finding(
              'The closed form holds to n&nbsp;=&nbsp;12',
              'confirmed',
              'Checked against brute force for every n up to 12.',
            ),
          ],
          tree: [['lead', '', 'Finished']],
          files: ['code/pinnacle.py', 'results/pinnacle_n12.csv'],
        };
      },
    },
    parking: {
      title: 'Parking functions by lucky cars',
      run: ['run-stopped', 'Stopped'],
      spend: '$0.12',
      age: 'ended 3 days ago, ran 40 min',
      ended: true,
      draw: function () {
        turn(
          'You',
          '<p class="say">Look at the distribution of lucky cars in parking functions.</p>',
        );
        turn(
          'lumen',
          work([
            step(
              'Searched',
              '5 s, $0.01',
              '<ul class="rows"><li><span class="row-src">arXiv</span><span class="row-q">lucky cars, parking functions</span><span class="row-res num">3 papers</span></li></ul>',
            ),
            step(
              'Recorded 1 finding',
              '',
              '<ul class="rows rows-finds"><li><span class="row-q">The lucky statistic is already characterised</span>' +
                V.dropped +
                '</li></ul>',
            ),
          ]) +
            '<p class="reply">Gessel and Seo, 2006, already give the generating function for lucky cars. I am checking whether a refinement is still open.</p>',
        );
        turn('You', '<p class="say">Stop here. It is known.</p>');
        return {
          finds: [
            finding(
              'The lucky statistic is already characterised',
              'dropped',
              'Gessel and Seo, 2006, give the generating function.',
            ),
          ],
          tree: [['lead', 'run-stopped', 'Stopped']],
          files: ['research/literature.md'],
        };
      },
    },
  };

  // Older projects: one request, one reply, one finding. They show the
  // habit the product is built on: say when a result is already known.
  function simple(title, run, spend, age, ask, reply, claim, verdict, ev, files) {
    return {
      title: title,
      run: run,
      spend: spend,
      age: age,
      ended: true,
      draw: function () {
        turn('You', '<p class="say">' + ask + '</p>');
        turn(
          'lumen',
          work([
            step(
              'Recorded 1 finding',
              '',
              '<ul class="rows rows-finds"><li><span class="row-q">' +
                claim +
                '</span>' +
                V[verdict] +
                '</li></ul>',
            ),
          ]) +
            '<p class="reply">' +
            reply +
            '</p>',
        );
        return {
          finds: [finding(claim, verdict, ev)],
          tree: [['lead', run[0], run[1]]],
          files: files,
        };
      },
    };
  }
  PROJECTS.motzkin = simple(
    'Motzkin paths by peak height',
    ['', 'Finished'],
    '$0.22',
    'ended 5 days ago, ran 50 min',
    'Look at Motzkin paths by the height of their highest peak.',
    'The distribution by peak height is already known, and my counts reproduce it. There is nothing new here, so I stopped.',
    'The peak-height distribution is already known',
    'dropped',
    'My counts reproduce the published table.',
    ['code/motzkin.py'],
  );
  PROJECTS.ballot = simple(
    'Ballot sequences and descents',
    ['', 'Finished'],
    '$0.17',
    'ended last week, ran 35 min',
    'Count descents in ballot sequences and compare them with known statistics.',
    'The descent statistic is equidistributed with a statistic already in the OEIS. I confirmed it for every length I computed.',
    'Descents are equidistributed with a known statistic',
    'confirmed',
    'Checked for every length up to 12.',
    ['code/ballot.py', 'results/ballot_n12.csv'],
  );
  PROJECTS.rgf = simple(
    'Restricted growth functions',
    ['run-stopped', 'Stopped'],
    '$0.08',
    'ended 2 weeks ago, ran 25 min',
    'Find a statistic on restricted growth functions that nobody has counted.',
    'I have three candidates and I am checking the literature for each one.',
    'Three candidate statistics',
    'open',
    'Stopped before the literature check finished.',
    ['research/candidates.md'],
  );

  function drawRail(r) {
    $('[data-find-count]').textContent = String(r.finds.length);
    $('[data-finds]').innerHTML = r.finds.length
      ? r.finds.join('')
      : '<li class="empty">No findings yet. Each one appears here when lumen confirms it, opens it as a question or drops it.</li>';
    $('[data-tree]').innerHTML = r.tree
      .map(function (t, i) {
        return (
          '<li' +
          (i ? ' class="child"' : '') +
          '><span class="tree-name">' +
          (i ? t[0] : 'lumen, the lead') +
          '</span><span class="run' +
          (t[1] ? ' ' + t[1] : '') +
          '">' +
          t[2] +
          '</span></li>'
        );
      })
      .join('');
    $('[data-file-count]').textContent = String(r.files.length);
    $('[data-files]').innerHTML = r.files.length
      ? r.files
          .map(function (f) {
            return '<li>' + f + '</li>';
          })
          .join('')
      : '<li class="empty">No files yet.</li>';
  }
  function setHead(title, run, spend, age) {
    document.title = title + ', lumen';
    $('[data-title]').textContent = title;
    $('[data-title-narrow]').textContent = title;
    setRun(run[0], run[1]);
    $('[data-spend]').textContent = spend;
    $('[data-age]').textContent = age;
  }

  var params = new URLSearchParams(location.search);
  var p = PROJECTS[params.get('p')];
  var answered = null;
  try {
    answered = localStorage.getItem('lumen-inversion');
  } catch (err) {}
  if (p) {
    setHead(p.title, p.run, p.spend, p.age);
    log.querySelectorAll('.turn').forEach(function (t) {
      t.remove();
    });
    drawRail(p.draw());
    if (p.run[0] === 'run-wait')
      $('[data-hint]').textContent =
        'lumen is waiting for your answer above. A message here also reaches it.';
    if (p.ended)
      $('[data-hint]').textContent =
        'This project has ended. A message starts it again from where it stopped.';
  } else if (params.has('q')) {
    // A project just started from a form: your question, and only what
    // lumen has done so far.
    var q = params.get('q').trim();
    var free = params.get('mode') !== 'start';
    setHead(q || 'Free exploration', ['run-live', 'Running'], '$0.00', 'just started');
    log.querySelectorAll('.turn').forEach(function (t) {
      t.remove();
    });
    if (q) turn('You', '<p class="say">' + esc(q) + '</p>');
    turn(
      'lumen',
      work([
        step(
          'Thinking',
          '',
          thought(
            !q
              ? 'You left the field open, so I will choose one. First I will read what has been published recently, so that I do not rediscover something.'
              : free
                ? 'Before I pick a question I will read what has been published in this area recently, so that I do not rediscover something.'
                : 'I will read what you gave me first, then search for what is already known about it.',
          ),
        ),
      ]),
    );
    drawRail({ finds: [], tree: [['lead', 'run-live', 'Running']], files: [] });
  }

  // The well shows the three newest findings; the rest open on request, so
  // the call tree and the files stay in view.
  var more = $('[data-more]');
  var all = false;
  function fold() {
    var items = document.querySelectorAll('[data-finds] > li:not(.empty)');
    items.forEach(function (li, i) {
      li.hidden = !all && i >= 3;
    });
    more.hidden = items.length <= 3;
    more.textContent = all ? 'Show fewer' : 'Show all ' + items.length;
  }
  fold();
  more.addEventListener('click', function () {
    all = !all;
    fold();
  });

  // An approval is answered in place: the question becomes your answer.
  log.addEventListener('click', function (e) {
    var ok = e.target.closest('[data-approve]');
    var no = e.target.closest('[data-decline]');
    if (!ok && !no) return;
    $('[data-ask]').remove();
    if (ok) {
      turn(
        'You',
        '<p class="say">Approved: spend about $2.40 to extend the count to n&nbsp;=&nbsp;14.</p>',
      );
      turn(
        'lumen',
        work([
          step(
            'Thinking',
            '',
            thought('Running n&nbsp;=&nbsp;13 now. I will report when n&nbsp;=&nbsp;14 is done.'),
          ),
        ]),
      );
    } else {
      turn('You', '<p class="say">Not now.</p>');
      turn(
        'lumen',
        work([
          step(
            'Thinking',
            '',
            thought('I will stop at n&nbsp;=&nbsp;12 and write up what the counts show.'),
          ),
        ]),
      );
    }
    // One answer, one state, everywhere: the bar, the call tree, and the
    // row on home the next time it loads.
    setRun('run-live', 'Running');
    $('[data-age]').textContent = '2 h 01 min elapsed';
    var lead = document.querySelector('[data-tree] .run');
    lead.className = 'run run-live';
    lead.textContent = 'Running';
    try {
      localStorage.setItem('lumen-inversion', ok ? 'approved' : 'declined');
    } catch (err) {}
    $('[data-hint]').textContent =
      'lumen keeps working while you write. It reads your message at its next step.';
    syncStop();
    log.scrollTop = log.scrollHeight;
    window.rasterEdges(log);
  });

  // Each finding on the well opens the step in the conversation that
  // recorded it; the step is marked for a moment so the eye finds it.
  function linkFinds() {
    document.querySelectorAll('[data-finds] > li').forEach(function (li) {
      var c = li.querySelector('.find-claim');
      if (!c) return;
      var src = Array.prototype.find.call(
        document.querySelectorAll('.rows-finds li'),
        function (r) {
          return r.querySelector('.row-q').textContent === c.textContent;
        },
      );
      if (!src) return;
      li.setAttribute('data-src', '');
      li.setAttribute('title', 'Show where lumen recorded this');
      li.addEventListener('click', function () {
        document.documentElement.classList.remove('show-rail');
        src.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
        src.classList.add('is-found');
        setTimeout(function () {
          src.classList.remove('is-found');
        }, 1600);
      });
    });
  }
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  linkFinds();

  // The other direction: a finding recorded in the conversation opens its
  // entry on the well (the sheet, on a narrow screen).
  log.addEventListener('click', function (e) {
    var row = e.target.closest('.rows-finds li');
    if (!row) return;
    var claim = row.querySelector('.row-q').textContent;
    var item = Array.prototype.find.call(
      document.querySelectorAll('[data-finds] > li'),
      function (li) {
        var c = li.querySelector('.find-claim');
        return c && c.textContent === claim;
      },
    );
    if (!item) return;
    if (item.hidden) {
      all = true;
      fold();
    }
    if (window.matchMedia('(max-width: 1080px)').matches) setRail(true);
    item.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    item.classList.add('is-found');
    setTimeout(function () {
      item.classList.remove('is-found');
    }, 1600);
  });

  // Stop ends the run, after one confirming click: it cannot be undone
  // from here. lumen keeps what it has recorded, and the stop holds across
  // reloads and on home.
  var key = 'lumen-stopped-' + (params.get('p') || (params.has('q') ? 'new' : 'popstack'));
  var stopBtn = $('[data-stop]');
  var armed = null;
  function syncStop() {
    stopBtn.hidden = !/run-live|run-wait/.test($('[data-state]').className);
  }
  function disarm() {
    clearTimeout(armed);
    armed = null;
    stopBtn.textContent = 'Stop';
    stopBtn.classList.remove('is-armed');
  }
  // An armed Stop is cancelled by Escape or by a click anywhere else.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && armed) disarm();
  });
  document.addEventListener('click', function (e) {
    if (armed && e.target !== stopBtn) disarm();
  });
  stopBtn.addEventListener('click', function () {
    if (!armed) {
      stopBtn.textContent = 'Stop now?';
      stopBtn.classList.add('is-armed');
      armed = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    doStop();
    try {
      localStorage.setItem(key, '1');
    } catch (err) {}
  });
  function doStop() {
    turn('You', '<p class="say">Stop.</p>');
    turn(
      'lumen',
      work([
        step(
          'Stopped',
          '',
          thought('I stopped at your request. Everything recorded so far is kept.'),
        ),
      ]),
    );
    setRun('run-stopped', 'Stopped');
    var lead = document.querySelector('[data-tree] .run');
    lead.className = 'run run-stopped';
    lead.textContent = 'Stopped';
    $('[data-hint]').textContent =
      'This project has ended. A message starts it again from where it stopped.';
    $('[data-age]').textContent = 'stopped just now';
    syncStop();
    log.scrollTop = log.scrollHeight;
    window.rasterEdges(log);
  }
  syncStop();
  var wasStopped = null;
  try {
    wasStopped = localStorage.getItem(key);
  } catch (err) {}

  // Coming back to a question already answered shows the answer.
  if (params.get('p') === 'inversion' && answered) {
    var b = $(answered === 'approved' ? '[data-approve]' : '[data-decline]');
    if (b) b.click();
  }

  if (wasStopped && !stopBtn.hidden) doStop();

  // Arriving from a finding on home: open the step that recorded it.
  var f = params.get('f');
  if (f) {
    var item = Array.prototype.find.call(
      document.querySelectorAll('[data-finds] > li[data-src]'),
      function (li) {
        return li.querySelector('.find-claim').textContent === f;
      },
    );
    if (item)
      setTimeout(function () {
        item.click();
      }, 0);
  }

  // The conversation opens at the start of your latest message, so the
  // first line in view is a whole turn, never the tail of a sentence.
  var you = log.querySelectorAll('.turn-you');
  var anchor = you.length ? you[you.length - 1] : null;
  if (anchor) {
    // When the latest exchange is shorter than the screen, room is added
    // under it so it can still start at the top.
    var top = anchor.offsetTop - log.offsetTop;
    var room = log.clientHeight - (log.scrollHeight - top);
    // A conversation that fits the screen is shown whole, from its start.
    if (log.scrollHeight <= log.clientHeight) {
      top = 0;
      room = 0;
    }
    if (room > 0) {
      var pad = document.createElement('div');
      pad.setAttribute('aria-hidden', 'true');
      pad.style.height = room + 'px';
      var edge = log.querySelector('.edge-bottom');
      if (edge) edge.before(pad);
      else log.appendChild(pad);
    }
    // If the latest exchange is taller than the screen, show its end, so
    // the newest reply is in view; the top fade covers the cut above.
    log.scrollTop = log.scrollHeight - top > log.clientHeight ? log.scrollHeight : top;
  } else {
    log.scrollTop = log.scrollHeight;
  }
  window.rasterEdges(log);
  window.rasterEdges($('#rail'));

  // A reply joins the conversation at once, marked as queued until lumen
  // reaches its next step.
  var form = $('[data-reply]');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = form.querySelector('.field-input');
    var v = input.value.trim();
    if (!v) return;
    var ended = !/run-live|run-wait/.test($('[data-state]').className);
    turn(
      'You',
      '<p class="say">' +
        esc(v) +
        '</p><p class="queued">' +
        (ended
          ? 'lumen starts again from where it stopped.'
          : 'Queued. lumen reads it at its next step.') +
        '</p>',
    );
    if (ended) {
      // A message to an ended project starts it again, as the hint said.
      setRun('run-live', 'Running');
      var lead = document.querySelector('[data-tree] .run');
      lead.className = 'run run-live';
      lead.textContent = 'Running';
      $('[data-age]').textContent = 'started again just now';
      $('[data-hint]').textContent =
        'lumen keeps working while you write. It reads your message at its next step.';
      try {
        localStorage.removeItem(key);
      } catch (err) {}
      syncStop();
    }
    input.value = '';
    log.scrollTop = log.scrollHeight;
    window.rasterEdges(log);
  });

  // Below 1080 px the well is a sheet, opened from the bar.
  var open = $('[data-rail-open]');
  var close = $('[data-rail-close]');
  function setRail(on) {
    document.documentElement.classList.toggle('show-rail', on);
    open.setAttribute('aria-expanded', String(on));
    if (on) {
      // The sheet opens at its top, with the fades read for its own size.
      var rail = $('#rail');
      rail.scrollTop = 0;
      window.rasterEdges(rail);
      close.focus();
    } else if (document.activeElement === close) open.focus();
  }
  open.addEventListener('click', function () {
    setRail(true);
  });
  close.addEventListener('click', function () {
    setRail(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setRail(false);
  });
})();
