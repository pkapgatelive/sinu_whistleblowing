import {Injectable, inject} from "@angular/core";
import {formatDate} from "@angular/common"; // Use Angular's built-in date formatting
import {TranslationService} from "@app/services/helper/translation.service";
import {NgbDatepickerI18n, NgbDateStruct} from '@ng-bootstrap/ng-bootstrap';

@Injectable()
export class CustomDatepickerI18n extends NgbDatepickerI18n {
  private translationService = inject(TranslationService);

  private locale: string;

  constructor() {
    super();
    // Use Angular's i18n system to determine the current locale
    this.translationService.currentLocale$.subscribe(locale => {
      if (locale === 'crh') {
        this.locale = 'tk';
      } else if (locale === 'dv') {
        this.locale = 'en';
      } else {
        this.locale = locale;
      }
    });
  }

  // Use Angular's formatDate to get short month names
  getMonthShortName(month: number): string {
    return formatDate(new Date(0, month - 1), 'MMM', this.locale); // 'MMM' gives short month name
  }

  // Use Angular's formatDate for weekday abbreviations
  getWeekdayShortName(weekday: number): string {
    const baseDate = new Date(1945, 3, 25); // April 25, 1945! A day of reference, it was a Wednesday!
                                            // Ora e sempre resistenza!
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + (weekday - 3));
    return formatDate(targetDate, 'EEE', this.locale);
  }

  // Full month name using Angular's formatDate
  getMonthFullName(month: number): string {
    return formatDate(new Date(0, month - 1), 'MMMM', this.locale); // 'MMMM' returns full month name
  }

  // Reuse the weekday short name logic
  getWeekdayLabel(weekday: number): string {
    return this.getWeekdayShortName(weekday); // Reuse the logic for weekday short names
  }

  // This method remains unchanged; it just returns the full date string for ARIA purposes
  getDayAriaLabel(date: NgbDateStruct): string {
    return `${date.day}-${date.month}-${date.year}`;
  }
}
