// true = short demo; false = full assessment
const QUICK_TEST = false;

// Find the page elements.
const home = document.getElementById("home-page");
const test = document.getElementById("test-page");
const area = document.getElementById("test-area");
const feedback = document.getElementById("test-feedback");
const title = document.getElementById("test-title");
const instructions = document.getElementById("test-instructions");
const progress = document.getElementById("test-progress");

const results = {};

// Save results in this browser.
function saveResults() {
  try {
    localStorage.setItem(
      "cozzmosResults",
      JSON.stringify(results)
    );
  } catch (error) {
    // The results still work if browser storage is unavailable.
    console.log("Results could not be saved in browser storage.");
  }
}

// Display instructions before each test.
function showTest(number, name, rules, startFunction) {
  home.hidden = true;
  test.hidden = false;
  document.getElementById("results-page").hidden = true;

  document.body.classList.add("pvt-mode");

  progress.textContent = "Test " + number + " of 4";
  title.textContent = name;
  instructions.textContent = rules;
  feedback.textContent = "";

  area.innerHTML =
    '<button id="test-start" type="button">Start Test</button>';

  document.getElementById("test-start").onclick = startFunction;

  window.scrollTo(0, 0);
}

// Announce the next section with a countdown.
function completeTest(name, data, nextFunction) {
  results[name] = data;
  saveResults();

  const nextNames = {
    pvt: "AX-CPT — Context and Control",
    ax: "Stroop — Selective Attention",
    stroop: "N-Back — Working Memory",
    nback: "Your Results"
  };

  title.textContent = "Section Complete ✓";
  progress.textContent = "";
  instructions.textContent = "Next up: " + nextNames[name];

  let seconds = QUICK_TEST ? 2 : 5;

  area.innerHTML =
    '<div class="stimulus">' + seconds + "</div>";

  feedback.textContent =
    name === "nback"
      ? "Your results are coming next."
      : "Take a breath. Read the next instructions before starting.";

  const countdown = setInterval(function () {
    seconds--;

    if (seconds === 0) {
      clearInterval(countdown);
      nextFunction();
    } else {
      area.firstElementChild.textContent = seconds;
    }
  }, 1000);
}

// Randomize a list.
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  return list;
}

// Homepage Begin Test button.
document.getElementById("start-button").onclick = function () {
  showTest(
    1,
    "PVT — Attention",
    "Watch the box. Click it as soon as yellow numbers appear. " +
    "Do not click while it is blank. After each response, " +
    "wait for the next signal. This section lasts " +
    (QUICK_TEST ? "10 seconds." : "2 minutes."),
    runPVT
  );
};

// ==================================================
// 1. PVT
// Demo: 10 seconds. Full: 2 minutes.
// ==================================================
function runPVT() {
  area.innerHTML =
    '<button id="box" type="button" ' +
    'aria-label="Click when yellow numbers appear"></button>';

  const box = document.getElementById("box");
  const times = [];

  let falseStarts = 0;
  let missed = 0;
  let state = "waiting";
  let started;
  let delayTimer;
  let counter;
  let responseTimer;

  function nextRound() {
    state = "waiting";
    box.textContent = "";
    feedback.textContent = "Watch the box…";

    // Wait randomly between 2 and 5 seconds.
    delayTimer = setTimeout(function () {
      state = "signal";
      started = performance.now();
      box.textContent = "0";
      feedback.textContent = "Respond now!";

      counter = setInterval(function () {
        box.textContent =
          Math.floor(performance.now() - started);
      }, 16);

      // A signal unanswered for 2 seconds is a missed signal.
      responseTimer = setTimeout(function () {
        missed++;
        endRound("No response");
      }, 2000);
    }, 2000 + Math.random() * 3000);
  }

  function endRound(message) {
    state = "feedback";

    clearInterval(counter);
    clearTimeout(responseTimer);

    box.textContent = message;
    feedback.textContent = "Your next signal will appear shortly.";

    delayTimer = setTimeout(nextRound, 1000);
  }

  box.onclick = function () {
    if (state === "waiting") {
      falseStarts++;
      feedback.textContent =
        "Too early! Wait for the yellow numbers.";
    } else if (state === "signal") {
      const time = performance.now() - started;

      // Responses under 100 ms are treated as anticipatory.
      if (time < 100) {
        falseStarts++;
        endRound("Too early");
      } else {
        times.push(time);
        endRound(Math.round(time) + " ms");
      }
    }
  };

  nextRound();

  setTimeout(function () {
    state = "finished";

    clearTimeout(delayTimer);
    clearTimeout(responseTimer);
    clearInterval(counter);

    box.disabled = true;

    const average = times.length
      ? Math.round(
          times.reduce((sum, time) => sum + time, 0) /
          times.length
        )
      : null;

    completeTest(
      "pvt",
      {
        average,
        reactionTimes: times,
        slowResponses: times.filter(time => time >= 500).length,
        falseStarts,
        missed
      },
      startAX
    );
  }, QUICK_TEST ? 10000 : 120000);
}

// ==================================================
// 2. AX-CPT
// Demo: 3 trials. Full: 30 trials.
// Each trial lasts 5 seconds.
// ==================================================
function startAX() {
  showTest(
    2,
    "AX-CPT — Context and Control",
    "Each round shows TWO letters. First, a CYAN letter: " +
    "always press M. Then, a WHITE letter: press C ONLY " +
    "if it is X and the cyan letter was A. Otherwise press M. " +
    "Examples: A → X = M then C. B → X = M then M. " +
    "A → Y = M then M. You have 1 second for each response.",
    runAX
  );
}

function runAX() {
  const pairs = QUICK_TEST
    ? ["AX", "BX", "AY"]
    : shuffle([
        ...Array(21).fill("AX"),
        ...Array(3).fill("BX"),
        ...Array(3).fill("AY"),
        ...Array(3).fill("BY")
      ]);

  area.innerHTML = '<div class="stimulus"></div>';

  const display = area.firstElementChild;
  const answers = [];

  let trial = 0;
  let phase = "waiting";
  let started;

  function record(key) {
    if (phase !== "cue" && phase !== "probe") return;

    const correctKey =
      phase === "probe" && pairs[trial] === "AX"
        ? "c"
        : "m";

    answers.push({
      trial: trial + 1,
      pair: pairs[trial],
      phase,
      key,
      correct: key === correctKey,
      reactionTime: key === null
        ? null
        : Math.round(performance.now() - started)
    });

    phase = "waiting";
    display.textContent = "";
  }

  function handleKey(event) {
    const key = event.key.toLowerCase();

    if (
      !event.repeat &&
      (key === "m" || key === "c") &&
      (phase === "cue" || phase === "probe")
    ) {
      event.preventDefault();
      record(key);
    }
  }

  function nextTrial() {
    if (trial === pairs.length) {
      phase = "finished";
      document.removeEventListener("keydown", handleKey);

      completeTest("ax", answers, startStroop);
      return;
    }

    feedback.textContent =
      "Trial " + (trial + 1) + "/" + pairs.length;

    display.style.color = "white";
    display.textContent = "+";

    // Show the cyan cue.
    setTimeout(function () {
      display.style.color = "cyan";
      display.textContent = pairs[trial][0];
      started = performance.now();
      phase = "cue";
    }, 500);

    // End the cue response window.
    setTimeout(function () {
      if (phase === "cue") record(null);
    }, 1500);

    // Show the white probe.
    setTimeout(function () {
      display.style.color = "white";
      display.textContent = pairs[trial][1];
      started = performance.now();
      phase = "probe";
    }, 2000);

    // End the probe response window.
    setTimeout(function () {
      if (phase === "probe") record(null);
    }, 3000);

    // Move to the next trial.
    setTimeout(function () {
      trial++;
      nextTrial();
    }, 5000);
  }

  document.addEventListener("keydown", handleKey);
  nextTrial();
}

// ==================================================
// 3. STROOP
// Demo: 4 trials. Full: 40 trials.
// Each trial lasts 3.75 seconds.
// ==================================================
function startStroop() {
  showTest(
    3,
    "Stroop — Selective Attention",
    "Select the INK COLOR, not what the word says. " +
    "If BLUE is written in red, select RED. " +
    "For a neutral word like TABLE, still select its ink color. " +
    "Use the color buttons beneath the word.",
    runStroop
  );
}

function runStroop() {
  const colors = ["red", "blue", "green", "yellow"];
  const ink = ["#ff6060", "#72b7ff", "#75ed95", "#ffe66b"];
  const count = QUICK_TEST ? 4 : 40;

  const types = shuffle(
    Array.from(
      { length: count },
      (_, i) =>
        ["congruent", "incongruent", "neutral"][i % 3]
    )
  );

  area.innerHTML =
    '<div class="stimulus"></div>' +
    '<div id="color-buttons"></div>';

  const display = area.firstElementChild;
  const buttons = document.getElementById("color-buttons");
  const answers = [];

  let trial = 0;
  let correctColor;
  let started;
  let answered = false;

  colors.forEach(function (color, index) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = color;

    button.onclick = function () {
      record(index);
    };

    buttons.appendChild(button);
  });

  function record(choice) {
    if (answered) return;
    answered = true;

    answers.push({
      trial: trial + 1,
      type: types[trial],
      correct: choice === correctColor,
      reactionTime: choice === null
        ? null
        : Math.round(performance.now() - started)
    });

    display.textContent = "";
    buttons.hidden = true;
  }

  function nextTrial() {
    if (trial === count) {
      completeTest("stroop", answers, startNBack);
      return;
    }

    correctColor = Math.floor(Math.random() * 4);

    const type = types[trial];
    let word = colors[correctColor];

    // Incongruent: word and ink color differ.
    if (type === "incongruent") {
      word = colors[
        (correctColor + 1 + Math.floor(Math.random() * 3)) % 4
      ];
    }

    // Neutral: not a color word.
    if (type === "neutral") {
      word = "TABLE";
    }

    display.textContent = word.toUpperCase();
    display.style.color = ink[correctColor];

    feedback.textContent =
      "Trial " + (trial + 1) + "/" + count;

    buttons.hidden = false;
    answered = false;
    started = performance.now();

    setTimeout(function () {
      if (!answered) record(null);

      trial++;
      nextTrial();
    }, 3750);
  }

  nextTrial();
}

// ==================================================
// 4. N-BACK
// Demo: 5 letters per block.
// Full: 20 letters in 1-back, 40 letters in 2-back.
// Each letter gets 3 seconds.
// ==================================================
function startNBack() {
  showTest(
    4,
    "N-Back — Part 1: 1-Back",
    "Compare each letter with the letter immediately BEFORE it. " +
    "Press M for a match, N for no match. " +
    "A → A = match on the second A. " +
    "A → B = no match on B. " +
    "Watch the first letter without responding; it is not scored.",
    runNBack
  );
}

function runNBack() {
  const answers = [];
  const letters = "ABCDEFGH";

  function runBlock(n) {
    area.innerHTML = '<div class="stimulus"></div>';

    const display = area.firstElementChild;
    const sequence = [];

    const count = QUICK_TEST
      ? 5
      : (n === 1 ? 20 : 40);

    let trial = 0;
    let started;
    let answered = true;
    let expectedMatch;

    function record(key) {
      if (answered) return;
      answered = true;

      answers.push({
        n,
        trial: trial + 1,
        expectedMatch,
        key,
        correct:
          key !== null && (key === "m") === expectedMatch,
        reactionTime: key === null
          ? null
          : Math.round(performance.now() - started)
      });
    }

    function handleKey(event) {
      const key = event.key.toLowerCase();

      if (
        !event.repeat &&
        (key === "m" || key === "n")
      ) {
        event.preventDefault();
        record(key);
      }
    }

    function nextLetter() {
      if (trial === count) {
        document.removeEventListener("keydown", handleKey);

        if (n === 1) {
          showSecondBlock();
        } else {
          completeTest("nback", answers, showResults);
        }

        return;
      }

      let letter;

      // About 30% of eligible letters are matches.
      if (trial >= n && Math.random() < 0.3) {
        letter = sequence[trial - n];
      } else {
        const options = [...letters].filter(
          item =>
            trial < n || item !== sequence[trial - n]
        );

        letter = options[
          Math.floor(Math.random() * options.length)
        ];
      }

      sequence.push(letter);

      expectedMatch =
        trial >= n && letter === sequence[trial - n];

      display.textContent = letter;
      display.style.color = "white";

      started = performance.now();

      // Initial letters provide context and aren't scored.
      answered = trial < n;

      feedback.textContent = trial < n
        ? "Watch and remember — no response yet."
        : n + "-BACK | Compare with " +
          (n === 1
            ? "the previous letter"
            : "TWO letters ago") +
          " | M = match · N = no match";

      // Hide the letter halfway through its response window.
      setTimeout(function () {
        display.textContent = "";
      }, 1500);

      setTimeout(function () {
        if (!answered) record(null);

        trial++;
        nextLetter();
      }, 3000);
    }

    title.textContent =
      "N-Back — Part " + n + ": " + n + "-Back";

    document.addEventListener("keydown", handleKey);
    nextLetter();
  }

  // Clearly announce the change from 1-back to 2-back.
  function showSecondBlock() {
    title.textContent =
      "1-Back Complete ✓ — Next: 2-Back";

    instructions.textContent =
      "NEW RULE: Compare with TWO letters ago. " +
      "Ignore the letter in between. " +
      "A → B → A = match on the final A. " +
      "A → B → B = NO match on the final B. " +
      "Press M for match, N for no match. " +
      "Watch the first TWO letters without responding; " +
      "they are not scored.";

    feedback.textContent =
      "Read the new rule before continuing.";

    area.innerHTML =
      '<button id="start-two-back" type="button">' +
      "Begin 2-Back</button>";

    document.getElementById("start-two-back").onclick =
      function () {
        runBlock(2);
      };
  }

  runBlock(1);
}

// ==================================================
// RESULTS: STARS, EXPLANATIONS, AND REFLECTION
// ==================================================
function showResults() {
  test.hidden = true;
  home.hidden = true;

  document.body.classList.remove("pvt-mode");

  const page = document.getElementById("results-page");
  page.hidden = false;

  page.innerHTML = `
    <h1>Your Focus Constellation</h1>
    <p>Each star represents your performance on one task.</p>

    <div id="constellation"></div>

    <section class="results-note">
      <h2>What these results mean</h2>
      <p>
        These scores describe this session. They cannot diagnose
        fatigue or rate your overall cognitive ability.
        Instructions, practice, distractions, and device timing
        can affect performance.
      </p>
      <p id="demo-note"></p>
    </section>

    <section class="results-note">
      <h2>Reflect on your session</h2>
      <p>Did these results match how focused you felt?</p>

      <div id="reflection-buttons">
        <button type="button" data-answer="Yes"
          aria-pressed="false">Yes</button>
        <button type="button" data-answer="Somewhat"
          aria-pressed="false">Somewhat</button>
        <button type="button" data-answer="No"
          aria-pressed="false">No</button>
      </div>

      <p id="reflection-feedback" aria-live="polite"></p>
    </section>

    <button id="restart-button" type="button">Try Again</button>
  `;

  const constellation = document.getElementById("constellation");

  // Create a star with its score and information underneath.
  function addStar(name, score, domain, explanation) {
    const card = document.createElement("article");
    card.className = "star-card";

    card.innerHTML = `
      <div class="score-star" aria-hidden="true">★</div>
      <h2></h2>
      <div class="star-score"></div>
      <h3></h3>
      <p></p>
    `;

    card.querySelector("h2").textContent = name;
    card.querySelector(".star-score").textContent = score;
    card.querySelector("h3").textContent = domain;
    card.querySelector("p").textContent = explanation;

    constellation.appendChild(card);
  }

  // Summarize accuracy and distinguish timeouts from responses.
  function summarize(answers) {
    const total = answers.length;
    const correct = answers.filter(
      answer => answer.correct
    ).length;

    const responses = answers.filter(
      answer => answer.reactionTime != null
    ).length;

    return {
      total,
      correct,
      responses,
      score: total
        ? Math.round(correct / total * 100) + "%"
        : "No data"
    };
  }

  // Explain the observed score without diagnosing a cause.
  function explain(summary, taskDescription, reminder) {
    if (summary.total === 0) {
      return "No scored trials were recorded, so this task " +
        "cannot be interpreted.";
    }

    if (summary.responses === 0) {
      return "No responses were recorded within the response " +
        "windows. Check the controls and instructions before " +
        "interpreting this score. " + reminder;
    }

    const count =
      summary.correct + " of " + summary.total +
      " scored answers were correct. ";

    if (summary.correct === 0) {
      return count + "Review the instructions before retrying. " +
        reminder + " This does not establish a cognitive difficulty.";
    }

    if (summary.correct === summary.total) {
      return count + "You performed accurately on " +
        taskDescription + " in this session.";
    }

    return count + "This task involved " + taskDescription +
      ". Errors or timeouts do not reveal why they occurred.";
  }

  // PVT results.
  const pvt = results.pvt;

  let pvtExplanation;

  if (pvt.average === null) {
    pvtExplanation =
      "No valid reaction times were recorded. Check that you " +
      "clicked when yellow numbers appeared before interpreting " +
      "this result. Early responses recorded: " + pvt.falseStarts +
      ". Missed signals: " + pvt.missed + ".";
  } else {
    pvtExplanation =
      "Your average valid reaction time was " + pvt.average +
      " ms. " + pvt.slowResponses +
      " responses took 500 ms or longer; " + pvt.missed +
      " signals were missed; " + pvt.falseStarts +
      " early responses were recorded. ";

    if (pvt.slowResponses === 0 && pvt.missed === 0) {
      pvtExplanation +=
        "All recorded valid responses were under 500 ms. ";
    }

    pvtExplanation +=
      "These describe your task responses, not a fatigue level.";
  }

  addStar(
    "PVT",
    pvt.average === null
      ? "No valid responses"
      : pvt.average + " ms",
    "Sustained attention & response speed",
    pvtExplanation
  );

  // AX-CPT results: white probes only.
  const ax = summarize(
    results.ax.filter(answer => answer.phase === "probe")
  );

  addStar(
    "AX-CPT",
    ax.score,
    "Context processing & response control",
    explain(
      ax,
      "using the first letter to choose a response to the second",
      "Press C for a white X only after a cyan A; otherwise press M."
    )
  );

  // Stroop results.
  const stroop = summarize(results.stroop);

  addStar(
    "Stroop",
    stroop.score,
    "Selective attention & interference control",
    explain(
      stroop,
      "selecting ink color while ignoring the written word",
      "Choose the ink color, not the word."
    ) + " Accuracy alone does not measure the size of the Stroop effect."
  );

  // N-back results: show each memory load separately.
  const oneBack = summarize(
    results.nback.filter(answer => answer.n === 1)
  );

  const twoBack = summarize(
    results.nback.filter(answer => answer.n === 2)
  );

  addStar(
    "N-Back",
    "1-back: " + oneBack.score + " · 2-back: " + twoBack.score,
    "Tracking & updating recent information",
    "1-back: " +
      explain(
        oneBack,
        "matching the immediately previous letter",
        "Compare with the previous letter."
      ) +
      " 2-back: " +
      explain(
        twoBack,
        "matching the letter two positions earlier",
        "Compare with TWO letters ago."
      ) +
      " These results do not establish your overall memory ability."
  );

  document.getElementById("demo-note").textContent =
    QUICK_TEST
      ? "Quick demo mode contains very few trials. Use these " +
        "results to explore the app, not evaluate cognitive ability."
      : "This is a custom shortened assessment without validated " +
        "normal or impaired score ranges.";

  // Save the user's reflection without grading it.
  document.querySelectorAll("#reflection-buttons button")
    .forEach(function (button) {
      button.onclick = function () {
        results.reflection = button.dataset.answer;
        saveResults();

        document.getElementById("reflection-feedback").textContent =
          "Saved: " + results.reflection +
          ". Your own experience adds context that these " +
          "scores cannot capture.";

        document.querySelectorAll("#reflection-buttons button")
          .forEach(function (option) {
            option.setAttribute(
              "aria-pressed",
              String(option === button)
            );
          });
      };
    });

  document.getElementById("restart-button").onclick = function () {
    location.reload();
  };

  window.scrollTo(0, 0);
}