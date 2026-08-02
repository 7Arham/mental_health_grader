(() => {
  'use strict';

  const BASE_URL = 'http://127.0.0.1:2200';

  const form        = document.getElementById('predict-form');
  const submitBtn   = document.getElementById('submit-btn');
  const formError   = document.getElementById('form-error');
  const apiStatus    = document.getElementById('api-status');

  const stressPicker = document.getElementById('stress_level');
  const stressValue   = document.getElementById('stress_level_value');

  const resultSection = document.getElementById('result');
  const resultClose    = document.getElementById('result-close');
  const resultAgain    = document.getElementById('result-again');
  const dialFill        = document.getElementById('dial-fill');
  const dialValue        = document.getElementById('dial-value');
  const resultTag         = document.getElementById('result-tag');

  const DIAL_CIRCUMFERENCE = 2 * Math.PI * 104; // matches r=104 in SVG

  /* ------------------------------------------------------------
     API health check
     ------------------------------------------------------------ */
  async function checkApi() {
    try {
      const res = await fetch(`${BASE_URL}/`, { method: 'GET' });
      if (res.ok) {
        apiStatus.classList.add('online');
        apiStatus.classList.remove('offline');
        apiStatus.innerHTML = '<i></i>API connected';
      } else {
        throw new Error('bad status');
      }
    } catch (err) {
      apiStatus.classList.add('offline');
      apiStatus.classList.remove('online');
      apiStatus.innerHTML = '<i></i>API unreachable';
    }
  }
  checkApi();

  /* ------------------------------------------------------------
     Stress level picker
     ------------------------------------------------------------ */
  stressPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.stress-opt');
    if (!btn) return;
    stressPicker.querySelectorAll('.stress-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    stressValue.value = btn.dataset.value;
    clearFieldError('stress_level');
  });

  /* ------------------------------------------------------------
     Field-level validation helpers
     ------------------------------------------------------------ */
  function fieldWrapper(name) {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.closest('.field') : null;
  }

  function setFieldError(name, message) {
    const wrap = fieldWrapper(name);
    if (!wrap) return;
    wrap.classList.add('has-error');
    const errEl = wrap.querySelector('.field__error') || document.querySelector(`.field__error[data-for="${name}"]`);
    if (errEl) errEl.textContent = message;
  }

  function clearFieldError(name) {
    const wrap = fieldWrapper(name);
    if (!wrap) return;
    wrap.classList.remove('has-error');
    const errEl = wrap.querySelector('.field__error') || document.querySelector(`.field__error[data-for="${name}"]`);
    if (errEl) errEl.textContent = '';
  }

  function clearAllErrors() {
    form.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
    form.querySelectorAll('.field__error').forEach(e => e.textContent = '');
    formError.classList.remove('show');
    formError.textContent = '';
  }

  const NUMERIC_RULES = {
    age:                     { min: 10, max: 100, label: 'Age must be between 10 and 100' },
    avg_daily_usage_hours:   { min: 0,  max: 24,  label: 'Must be between 0 and 24 hours' },
    daily_unlocks:           { min: 0,  max: null, label: 'Must be 0 or more' },
    study_hours:             { min: 0,  max: 24,  label: 'Must be between 0 and 24 hours' },
    physical_activity_hours: { min: 0,  max: 24,  label: 'Must be between 0 and 24 hours' },
    sleep_hours_per_night:   { min: 0,  max: 24,  label: 'Must be between 0 and 24 hours' },
  };

  function validateForm() {
    clearAllErrors();
    let valid = true;

    // required text/select fields
    ['gender', 'country', 'academic_level', 'most_used_platform', 'purpose_of_use'].forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el.value || !el.value.trim()) {
        setFieldError(name, 'This field is required');
        valid = false;
      }
    });

    // numeric fields
    Object.keys(NUMERIC_RULES).forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      const rule = NUMERIC_RULES[name];
      const raw = el.value.trim();
      if (raw === '') {
        setFieldError(name, 'This field is required');
        valid = false;
        return;
      }
      const num = Number(raw);
      if (Number.isNaN(num)) {
        setFieldError(name, 'Enter a valid number');
        valid = false;
        return;
      }
      if (num < rule.min || (rule.max !== null && num > rule.max)) {
        setFieldError(name, rule.label);
        valid = false;
      }
    });

    // stress level
    if (!stressValue.value) {
      setFieldError('stress_level', 'Pick a stress level');
      valid = false;
    }

    return valid;
  }

  /* ------------------------------------------------------------
     Result rendering
     ------------------------------------------------------------ */
  function scoreBand(score) {
    if (score >= 7.5) return { label: 'Thriving', color: '#7FE7C4' };
    if (score >= 5.5) return { label: 'Steady',   color: '#7FE7C4' };
    if (score >= 3.5) return { label: 'Under strain', color: '#F2C078' };
    return { label: 'At risk — reach out to someone', color: '#FF9B85' };
  }

  function renderResult(score) {
    const clamped = Math.max(0, Math.min(10, score));
    const percent = clamped / 10;
    const offset = DIAL_CIRCUMFERENCE * (1 - percent);
    const band = scoreBand(clamped);

    resultSection.hidden = false;
    form.hidden = true;

    dialValue.textContent = score.toFixed(2);
    resultTag.textContent = band.label;
    dialFill.style.stroke = band.color;
    dialFill.style.filter = `drop-shadow(0 0 10px ${band.color}66)`;

    // reset then animate
    dialFill.style.transition = 'none';
    dialFill.style.strokeDashoffset = DIAL_CIRCUMFERENCE;
    void dialFill.getBoundingClientRect();
    dialFill.style.transition = '';
    requestAnimationFrame(() => {
      dialFill.style.strokeDashoffset = offset;
    });

    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetToForm() {
    resultSection.hidden = true;
    form.hidden = false;
  }

  resultClose.addEventListener('click', resetToForm);
  resultAgain.addEventListener('click', resetToForm);

  /* ------------------------------------------------------------
     Submit
     ------------------------------------------------------------ */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('loading', isLoading);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.remove('show');

    if (!validateForm()) {
      const firstError = form.querySelector('.has-error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const fd = new FormData(form);
    const payload = {
      age:                      parseInt(fd.get('age'), 10),
      gender:                   fd.get('gender'),
      country:                  fd.get('country').trim(),
      academic_level:           fd.get('academic_level'),
      most_used_platform:       fd.get('most_used_platform'),
      purpose_of_use:           fd.get('purpose_of_use'),
      avg_daily_usage_hours:    parseFloat(fd.get('avg_daily_usage_hours')),
      daily_unlocks:            parseInt(fd.get('daily_unlocks'), 10),
      study_hours:              parseFloat(fd.get('study_hours')),
      physical_activity_hours:  parseFloat(fd.get('physical_activity_hours')),
      sleep_hours_per_night:    parseFloat(fd.get('sleep_hours_per_night')),
      stress_level:             fd.get('stress_level'),
    };

    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const msg = body && body.detail
          ? body.detail.map(d => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(' · ')
          : 'The server rejected some of the submitted values.';
        formError.textContent = msg;
        formError.classList.add('show');
        return;
      }

      if (!res.ok) {
        formError.textContent = `Server error (${res.status}). Please try again in a moment.`;
        formError.classList.add('show');
        return;
      }

      const data = await res.json();
      renderResult(data.predicted_mental_health_score);

    } catch (err) {
      formError.textContent = `Couldn't reach the API at ${BASE_URL}. Make sure the backend is running (uvicorn main:app --port 2200 --reload).`;
      formError.classList.add('show');
    } finally {
      setLoading(false);
    }
  });

})();
