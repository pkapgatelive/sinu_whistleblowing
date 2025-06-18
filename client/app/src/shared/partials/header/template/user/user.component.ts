import {ApplicationRef, Component, inject} from "@angular/core";
import {AuthenticationService} from "@app/services/helper/authentication.service";
import {PreferenceResolver} from "@app/shared/resolvers/preference.resolver";
import {AppConfigService} from "@app/services/root/app-config.service";
import {UtilsService} from "@app/shared/services/utils.service";
import {AppDataService} from "@app/app-data.service";
import {TranslationService} from "@app/services/helper/translation.service";
import {HttpService} from "@app/shared/services/http.service";
import {ActivatedRoute, Router} from "@angular/router";
import {NgClass} from "@angular/common";
import {NgSelectComponent, NgOptionComponent} from "@ng-select/ng-select";
import {FormsModule} from "@angular/forms";
import {ReceiptComponent} from "../../../receipt/receipt.component";
import {TranslateModule} from "@ngx-translate/core";
import {TranslatorPipe} from "@app/shared/pipes/translate";
import {OrderByPipe} from "@app/shared/pipes/order-by.pipe";
import {NgbTooltipModule} from '@ng-bootstrap/ng-bootstrap';


@Component({
    selector: "views-user",
    templateUrl: "./user.component.html",
    standalone: true,
    imports: [NgbTooltipModule, NgClass, NgSelectComponent, FormsModule, NgOptionComponent, ReceiptComponent, TranslateModule, TranslatorPipe, OrderByPipe]
})
export class UserComponent {
  protected activatedRoute = inject(ActivatedRoute);
  protected httpService = inject(HttpService);
  protected appConfigService = inject(AppConfigService);
  protected authentication = inject(AuthenticationService);
  protected preferences = inject(PreferenceResolver);
  protected utilsService = inject(UtilsService);
  protected appDataService = inject(AppDataService);
  protected translationService = inject(TranslationService);
  private router = inject(Router);

  private lastLang: string | null = null;

  constructor(private appRef: ApplicationRef) {
    this.onQueryParameterChangeListener();
  }

  onQueryParameterChangeListener() {
    this.activatedRoute.queryParams.subscribe(params => {
      const currentLang = params['lang'];
      const isSubmissionRoute = this.router.url.includes('/submission');
      const storageLanguage = sessionStorage.getItem("language");
      const languagesEnabled = this.appDataService.public.node.languages_enabled;

      if (currentLang && languagesEnabled.includes(currentLang)) {
        if (isSubmissionRoute && this.lastLang && this.lastLang !== currentLang) {
          location.reload();
        }
        else if (storageLanguage !== currentLang) {
          this.translationService.onChange(currentLang);
          sessionStorage.setItem("language", currentLang);
          if (!isSubmissionRoute) {
            this.appConfigService.reinit(true);
            this.utilsService.reloadCurrentRouteFresh();
          }
        }
      }
      this.lastLang = currentLang;
    });
  }

  onLogout(event: Event) {
    event.preventDefault();
    const promise = () => {
      this.translationService.onChange(this.appDataService.public.node.default_language);
      this.appConfigService.reinit(false);
      this.appConfigService.onValidateInitialConfiguration();
    };

    this.authentication.logout(promise);
  }

  onChangeLanguage() {
    this.translationService.onChange(this.translationService.language);
    this.appConfigService.reinit(true);
    this.utilsService.reloadCurrentRouteFresh(true);
    this.appRef.tick();
  }
}
