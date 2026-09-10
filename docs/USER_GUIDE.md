# Andy Tours Admin — User Guide

This guide explains how to use the Andy Tours Admin app: what each screen does, how the
different features work together, and things worth knowing so nothing catches you by
surprise.

## Contents

- [Getting started](#getting-started)
- [Getting around the app](#getting-around-the-app)
- [Dashboard](#dashboard)
- [Tours](#tours)
- [Bookings](#bookings)
- [Calendar](#calendar)
- [Settings](#settings)
- [Signing out](#signing-out)
- [Good to know](#good-to-know)

---

## Getting started

When you open the app you'll see a sign-in screen. Enter your email and password and
select **Sign in**.

- You need an account before you can sign in — an administrator sets this up for you.
- If your email or password is wrong, an error message appears under the form.
- Once you're signed in, the app remembers you between launches, so you normally won't
  need to sign in every time you open it.

## Getting around the app

The sidebar on the left is how you move between sections:

- **Dashboard** — a quick overview
- **Bookings** — every customer booking
- **Calendar** — bookings laid out on a month grid
- **Tours** — the tours you offer
- **Settings** — appearance preferences
- **Users** — not built yet (see [Good to know](#good-to-know))

Select the arrow at the bottom of the sidebar to collapse it down to icons only if you
want more room, and select it again to expand it back.

## Dashboard

The Dashboard gives you a snapshot: total bookings, revenue this month, upcoming tours,
and cancellations, plus a 7-day bookings chart and a recent-bookings list.

> **Note:** The Dashboard currently shows sample numbers, not your live data. Use the
> Bookings and Calendar screens for real, up-to-date figures.

## Tours

The Tours screen lists every tour you offer, with its price, status, and creation date.

### Finding a tour

- Use the search box to filter by title or slug.
- Use the **All / Active / Inactive** tabs to filter by status. Each tab shows a live
  count.
- Select a tour's row (or the **View** action) to see its full details, including its
  description, categories, and image gallery.

### Creating a tour

Select **New Tour** to open the form. It has two tabs:

**Details**
| Field | Notes |
|---|---|
| Title | Required. |
| Description | Required — the full write-up for the tour. |
| Summary | Optional short one-liner used in listings. |
| Price | Required, the regular price. |
| Price discount | Optional — a lower price shown alongside the crossed-out regular price. |
| Duration (days) | Optional. Used to work out when a booking finishes. |
| Max group size | Optional. |
| Difficulty | Optional — Easy, Medium, or Difficult. |
| Cover image | Optional. Drag & drop an image onto the box or click it to browse. |
| Start location | Optional. |
| Active | On by default — see below. |

**Images**: a gallery of additional photos. Drag and drop multiple images, or click to
browse, and remove any you don't want with the small × button on each thumbnail.

Accepted image types are JPEG, PNG, WebP, and GIF, up to 5MB each.

Select **Create Tour** to save. If something's missing or invalid, the problem is shown
directly under the relevant field.

### Editing a tour

Select **Edit** (from the row menu, or the ⋮ overflow menu) to open the same form
pre-filled with the tour's current details. Change what you need and select
**Save Changes**.

### Active vs. Inactive

The **Active** toggle controls whether a tour is bookable on the public booking website.
- **Active** tours appear on the site and can be booked.
- **Inactive** tours are hidden from the site but stay in the admin app so you can bring
  them back later.

You can flip a tour between the two any time using the **Suspend** / **Activate** button
on its row — you don't need to open the full edit form just to do this.

### Deleting a tour

Use **Delete** from the row's overflow menu. You'll be asked to confirm, since this
can't be undone. A tour that already has bookings attached to it can't be deleted.

## Bookings

The Bookings screen lists every booking, with its reference number, tour, customer,
dates, payment progress, and status.

### Booking statuses

| Status | Meaning |
|---|---|
| **Pending** | Submitted by a customer through the public booking website and awaiting your confirmation. |
| **Confirmed** | Accepted and locked in. Bookings you create yourself in the admin app start out Confirmed. |
| **Ongoing** | The tour has started. |
| **Completed** | The tour has finished and the booking is fully paid. This happens automatically — you don't need to mark it. |
| **Cancelled** | Cancelled, with a record of any amount refunded. |

### Payment statuses

Shown separately from the booking status: **Unpaid**, **Partial**, **Paid**, or
**Refunded** — based on how much of the total price has been recorded as paid so far.

### Finding a booking

Search by reference number, tour name, or customer name, and use the **All / Pending /
Confirmed / Cancelled** tabs to narrow the list. Select any row to see the full booking
detail, including its payment history.

### Creating a booking

Select **New Booking** to open the form:

1. **Tour** — choose from your list of tours.
2. **Participants** — number of people.
3. **Booking Date** — pick a date from the calendar picker.
4. **Customer** — either:
   - Search for an existing customer by name or email (type at least 2 characters), or
   - Select **Add a new customer** and enter their name, email, and optional phone
     number.
5. **Notes** — optional, anything worth noting about the booking.

The total price is worked out automatically from the tour's price (or discounted price,
if it has one) times the number of participants. Select **Create Booking** to save —
bookings created this way start out **Confirmed**.

### Confirming a Pending booking

Bookings placed by customers on the public website start as **Pending**. Select
**Confirm** on that booking to accept it and move it to **Confirmed**.

### Editing a booking

Select **Edit** to change the tour, participants, date, customer, or notes. This is only
available while the booking is still editable — see below.

### When a booking is locked

A booking's details can no longer be changed once it becomes **due**: this happens when
it's Ongoing, Completed, or it's Confirmed and its start date has arrived or passed.
At that point:

- You can no longer **Edit** it or change its **Tour / Participants / Date / Customer**.
- You can still **record a payment** on it, as long as it isn't already fully paid.
- You can still **cancel** it, unless it's also already fully paid — a fully-paid,
  due/ongoing/completed booking can no longer be cancelled from here.

### Marking a booking Ongoing

Once a Confirmed booking's start date has arrived, select **Mark Ongoing** to reflect
that the tour is underway. You'll be asked to confirm, since the booking becomes locked
from that point on.

Bookings automatically flip from Ongoing/Confirmed to **Completed** on their own once
the tour's last day has passed and the balance is fully paid — there's nothing to click
for that step.

### Recording a payment

Select **Record Payment** on a booking that isn't fully paid yet. In the dialog:

1. Enter the **amount received now** (or select **Full remaining balance** to fill in
   what's left automatically).
2. Choose how it was paid:
   - **Cash**
   - **Invoice** — enter an invoice reference number.
   - **Upload file** — attach a photo or PDF as proof of payment (image or PDF, up to
     5MB).
3. Select **Record payment**.

The booking's amount paid and payment status update immediately, and the payment is
added to that booking's payment history (visible on its detail view).

### Cancelling a booking

Select **Cancel** on a booking's row.

- **Pending bookings** (never confirmed): cancelling is a single confirmation — any
  amount already paid is automatically marked as fully refunded.
- **Confirmed / Ongoing bookings**: you'll be asked how much of the amount already
  collected to refund, from $0 up to the full amount paid. Choosing an amount greater
  than $0 marks the booking's payment status as **Refunded**.

Cancelling cannot be undone.

## Calendar

The Calendar shows the current month as a grid, with a small dot under any day that has
at least one booking starting on it. Hover or select a day with bookings to see a
pop-up list of that day's bookings — reference, tour, customer, status, and payment
status — without leaving the calendar.

## Settings

Currently just one tab:

**Appearance** — choose **System**, **Light**, or **Dark** to control the app's color
theme. System follows your computer's current setting automatically.

## Signing out

Select **Sign out** at the bottom of the sidebar. You'll be asked to confirm before
you're signed out.

## Good to know

- **Users section**: the sidebar has a Users entry, but that section isn't built yet.
- **Dashboard numbers are sample data** for now — rely on Bookings/Calendar for real
  figures until the Dashboard is wired up to live data.
- **Long idle sessions**: if the app has been open for a long time without use and an
  action suddenly fails with a session/login-style error, simply sign out and back in
  again.
- **Money amounts** are shown in your store's base currency with two decimal places
  (e.g. `$120.00`); the app doesn't currently handle multiple currencies.
