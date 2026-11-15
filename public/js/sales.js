/* "Talk to sales": sends the school's details to the server (they appear in Admin > Enquiries). */
(function () {
  'use strict';
  var f = document.getElementById('salesForm');
  if (!f) return;
  var err = f.querySelector('.err'), btn = f.querySelector('button[type=submit]');
  f.addEventListener('submit', function (e) {
    e.preventDefault(); err.textContent = '';
    var classes = [].map.call(f.querySelectorAll('#classChips input:checked'), function (i) { return Number(i.value); });
    btn.disabled = true; btn.textContent = 'Sending…';
    BL.api('/enquiry', { method: 'POST', body: { institute: f.institute.value, city: f.city.value, name: f.name.value, role: f.role.value, email: f.email.value, phone: f.phone.value,
      students: f.students.value, classes: classes, message: f.message.value, website: f.website.value } })
      .then(function () { document.getElementById('salesWrap').classList.add('hide'); document.getElementById('salesDone').classList.remove('hide'); window.scrollTo(0, 0); })
      .catch(function (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = 'Send'; });
  });
})();
