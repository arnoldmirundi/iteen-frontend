import { BreakpointObserver } from '@angular/cdk/layout';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { map } from 'rxjs';
import { COUNTRIES } from '../../data/countries';
import { Category, CreateRegistration, Registration } from '../../models/registration.model';
import { RegistrationApi } from '../../services/registration-api';

const TEAM_FEE_USD = 100;
const FEE_EXEMPT_COUNTRY = 'Rwanda';

type EntryForm = FormGroup<{
  section: FormControl<string>;
  ageGroup: FormControl<string>;
  count: FormControl<number>;
}>;

const atLeastOneTeam: ValidatorFn = (control) => {
  const entries = control.value as { count: number }[];
  return entries.some((e) => e.count > 0) ? null : { noTeams: true };
};

const ageNumber = (c: Category) => parseInt(c.ageGroup.replace(/\D/g, ''), 10);

@Component({
  selector: 'app-registration-form',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
  ],
  templateUrl: './registration-form.html',
  styleUrl: './registration-form.css',
})
export class RegistrationForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(RegistrationApi);

  readonly countries = COUNTRIES;
  readonly roles = ['Coach', 'Administrator', 'Other'];
  readonly teamOptions = [0, 1, 2, 3, 4];

  readonly isSmall = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 700px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  // ---- Forms ----
  readonly clubForm = this.fb.group({
    clubName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    country: [FEE_EXEMPT_COUNTRY, Validators.required],
    logo: ['', Validators.pattern(/^https?:\/\/.+/)],
    kitPrimary: ['', Validators.maxLength(30)],
    kitSecondary: ['', Validators.maxLength(30)],
  });

  readonly contactForm = this.fb.group({
    contactName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    contactRole: ['Coach', Validators.required],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ()-]{7,20}$/)]],
  });

  readonly entries = new FormArray<EntryForm>([], atLeastOneTeam);
  readonly notes = this.fb.control('', Validators.maxLength(1000));

  // ---- Derived state (live fee) ----
  private readonly entriesValue = toSignal(this.entries.valueChanges, {
    initialValue: this.entries.getRawValue(),
  });
  private readonly country = toSignal(this.clubForm.controls.country.valueChanges, {
    initialValue: this.clubForm.controls.country.value,
  });

  readonly selectedEntries = computed(() =>
    this.entriesValue().filter((e) => (e.count ?? 0) > 0),
  );
  readonly teamCount = computed(() =>
    this.selectedEntries().reduce((sum, e) => sum + (e.count ?? 0), 0),
  );
  readonly feeExempt = computed(() => this.country() === FEE_EXEMPT_COUNTRY);
  readonly amountDue = computed(() => (this.feeExempt() ? 0 : this.teamCount() * TEAM_FEE_USD));

  // ---- Request state ----
  readonly loadError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly result = signal<Registration | null>(null);
  readonly resultTeamCount = computed(
    () => this.result()?.entries.reduce((sum, e) => sum + e.count, 0) ?? 0,
  );

  constructor() {
    this.api.getCategories().subscribe({
      next: (categories) => {
        [...categories]
          .sort((a, b) => a.section.localeCompare(b.section) || ageNumber(a) - ageNumber(b))
          .forEach((c) => this.entries.push(this.createEntry(c)));
      },
      error: () => this.loadError.set('Could not load the categories. Please try again later.'),
    });
  }

  private createEntry(category: Category): EntryForm {
    return this.fb.group({
      section: [category.section],
      ageGroup: [category.ageGroup],
      count: [0, [Validators.min(0), Validators.max(4)]],
    });
  }

  submit() {
    if (this.clubForm.invalid || this.contactForm.invalid || this.entries.invalid) return;

    const club = this.clubForm.getRawValue();
    const body: CreateRegistration = {
      clubName: club.clubName.trim(),
      country: club.country,
      logo: club.logo || undefined,
      kitPrimary: club.kitPrimary || undefined,
      kitSecondary: club.kitSecondary || undefined,
      ...this.contactForm.getRawValue(),
      entries: this.entries.getRawValue().filter((e) => e.count > 0),
      notes: this.notes.value || undefined,
    };

    this.submitting.set(true);
    this.submitError.set(null);

    this.api.submit(body).subscribe({
      next: (registration) => {
        this.result.set(registration);
        this.submitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.submitError.set(this.errorMessage(err));
        this.submitting.set(false);
      },
    });
  }

  reset() {
    this.clubForm.reset();
    this.contactForm.reset();
    this.entries.reset();
    this.notes.reset();
    this.result.set(null);
  }

  private errorMessage(err: HttpErrorResponse): string {
    const message = err.error?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
    if (err.status === 0) return 'Cannot reach the server. Please check your connection.';
    return 'Something went wrong. Please try again.';
  }
}