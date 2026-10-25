import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Registration } from '../../models/registration.model';
import { AdminApi } from '../../services/admin-api';

type Filter = 'all' | Registration['status'];

const teamCount = (r: Registration) => r.entries.reduce((sum, e) => sum + e.count, 0);

@Component({
  selector: 'app-admin',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  protected readonly api = inject(AdminApi);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly columns = ['createdAt', 'club', 'contact', 'teams', 'fee', 'status', 'actions'];
  readonly loginForm = this.fb.group({ key: ['', Validators.required] });

  readonly registrations = signal<Registration[]>([]);
  readonly filter = signal<Filter>('pending');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  readonly visible = computed(() => {
    const filter = this.filter();
    const list = this.registrations();
    return filter === 'all' ? list : list.filter((r) => r.status === filter);
  });

  readonly stats = computed(() => {
    const list = this.registrations();
    const withStatus = (s: Registration['status']) => list.filter((r) => r.status === s);
    const approved = withStatus('approved');
    const pending = withStatus('pending');

    return {
      total: list.length,
      pending: pending.length,
      approved: approved.length,
      rejected: withStatus('rejected').length,
      confirmedTeams: approved.reduce((sum, r) => sum + teamCount(r), 0),
      outstanding: pending
        .filter((r) => r.paymentStatus === 'unpaid')
        .reduce((sum, r) => sum + r.amountDue, 0),
      collected: list
        .filter((r) => r.paymentStatus === 'paid')
        .reduce((sum, r) => sum + r.amountDue, 0),
    };
  });

  constructor() {
    if (this.api.apiKey()) this.load();
  }

  login() {
    const key = this.loginForm.controls.key.value.trim();
    if (!key) return;
    this.api.setKey(key);
    this.load();
  }

  logout() {
    this.api.setKey(null);
    this.registrations.set([]);
    this.loginForm.reset();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (list) => {
        this.registrations.set(list);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.handleError(err);
      },
    });
  }

  approve(r: Registration) {
    const question =
      r.paymentStatus === 'unpaid'
        ? `Confirm that ${r.clubName} has paid $${r.amountDue} and approve their ${teamCount(r)} team(s)?`
        : `Approve ${r.clubName}?`;
    if (!confirm(question)) return;

    this.busyId.set(r.id);
    this.api.approve(r.id).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.snackBar.open(`${r.clubName} approved: teams created`, 'Close', { duration: 4000 });
      },
      error: (err: HttpErrorResponse) => this.handleError(err),
    });
  }

  reject(r: Registration) {
  const reason = prompt(
    `Reject the registration from ${r.clubName}?\n\nOptional: a reason to include in the email.`,
    '',
  );
  if (reason === null) return; // cancelled

  this.busyId.set(r.id);
  this.api.reject(r.id, reason.trim() || undefined).subscribe({
    next: (updated) => {
      this.replace(updated);
      this.snackBar.open(`${r.clubName} rejected: email sent`, 'Close', { duration: 4000 });
    },
    error: (err: HttpErrorResponse) => this.handleError(err),
  });
}

resendEmail(r: Registration) {
  this.busyId.set(r.id);
  this.api.resendEmail(r.id).subscribe({
    next: (res) => {
      this.busyId.set(null);
      this.snackBar.open(`Email sent to ${res.to}`, 'Close', { duration: 4000 });
    },
    error: (err: HttpErrorResponse) => this.handleError(err),
  });
}

  teams(r: Registration) {
    return teamCount(r);
  }

  private replace(updated: Registration) {
    this.registrations.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    this.busyId.set(null);
  }

  private handleError(err: HttpErrorResponse) {
    this.busyId.set(null);

    if (err.status === 401) {
      this.logout();
      this.error.set('That API key is not valid.');
      return;
    }

    const message = err.error?.message;
    const text = Array.isArray(message)
      ? message.join('. ')
      : typeof message === 'string'
        ? message
        : err.status === 0
          ? 'Cannot reach the server.'
          : 'Something went wrong.';

    this.snackBar.open(text, 'Close', { duration: 6000 });
  }
}