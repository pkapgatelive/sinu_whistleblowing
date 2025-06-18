import {Injectable, inject, SecurityContext} from "@angular/core";
import {LoginDataRef} from "@app/pages/auth/login/model/login-model";
import {HttpService} from "@app/shared/services/http.service";
import {firstValueFrom, of, Observable} from "rxjs";
import {finalize} from 'rxjs/operators';
import {ActivatedRoute, Router} from "@angular/router";
import {AppDataService} from "@app/app-data.service";
import {ErrorCodes} from "@app/models/app/error-code";
import {Session} from "@app/models/authentication/session";
import {TitleService} from "@app/shared/services/title.service";
import {HttpClient, HttpErrorResponse, HttpHeaders} from "@angular/common/http";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {OtkcAccessComponent} from "@app/shared/modals/otkc-access/otkc-access.component";
import {DomSanitizer} from '@angular/platform-browser';
import {CryptoService} from "@app/shared/services/crypto.service";
import {TokenResponse} from "@app/models/authentication/token-response";

@Injectable({
  providedIn: "root"
})
export class AuthenticationService {
  private http = inject(HttpClient);
  private modalService = inject(NgbModal);
  private titleService = inject(TitleService);
  private activatedRoute = inject(ActivatedRoute);
  private httpService = inject(HttpService);
  private appDataService = inject(AppDataService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private cryptoService = inject(CryptoService);

  public session: any = undefined;
  permissions: { can_upload_files: boolean }
  loginInProgress: boolean = false;
  requireAuthCode: boolean = false;
  loginData: LoginDataRef = new LoginDataRef();

  constructor() {
    this.init();
  }

  init() {
    this.session = window.sessionStorage.getItem("session");
    if (typeof this.session === "string") {
      this.session = JSON.parse(this.session);
    }
  }

  public reset() {
    this.loginInProgress = false;
    this.requireAuthCode = false;
    this.loginData = new LoginDataRef();
  };

  deleteSession() {
    const role = this.session ? this.session.role : 'recipient';

    this.session = null;
    window.sessionStorage.clear();

    if (role === "whistleblower") {
      window.location.replace("about:blank");
    } else {
      this.loginRedirect();
    }
  };

  setSession(response: Session) {
    this.session = response;
    if (this.session.role === "whistleblower") {
      this.session.homepage = "/";
    } else {
      const role = this.session.role === "receiver" ? "recipient" : this.session.role;

      this.session.homepage = "/" + role + "/home";
      this.session.preferencespage = "/" + role + "/preferences";
      window.sessionStorage.setItem("session", JSON.stringify(this.session));
    }
  }

  resetPassword(username: string) {
    const param = JSON.stringify({"username": username});
    this.httpService.requestResetLogin(param).subscribe(
      {
        next: () => {
          this.router.navigate(["/login/passwordreset/requested"]).then();
        }
      }
    );
  }

  async login(tid?: number, username?: string, password?: string | undefined, authcode?: string | undefined, authtoken?: string | null, callback?: () => void) {
    this.appDataService.updateShowLoadingPanel(true);

    try {
      if (authcode === undefined) {
        authcode = "";
      }

      let requestObservable: Observable<Session>;
      if (authtoken) {
        requestObservable = this.httpService.requestAuthTokenLogin(JSON.stringify({"authtoken": authtoken}));
      } else {
        const authHeader = this.getHeader();
        if (password) {
            if (username === "whistleblower") {
              password = password.replace(/\D/g, "");
            }

            const res = await firstValueFrom(this.httpService.requestAuthType(JSON.stringify({'username': username !== "whistleblower" ? username : ""})));
            if (res.type == 'key') {
              this.appDataService.updateShowLoadingPanel(true);
              password = await this.cryptoService.hashArgon2(password, res.salt);
              this.appDataService.updateShowLoadingPanel(false);
            }
        }

        if (username === "whistleblower") {
          requestObservable = this.httpService.requestWhistleBlowerLogin(JSON.stringify({"receipt": password}), authHeader);
        } else {
          requestObservable = this.httpService.requestGeneralLogin(JSON.stringify({
            "tid": tid,
            "username": username,
            "password": password,
            "authcode": authcode
          }), authHeader);
        }
      }

      requestObservable.pipe(finalize(() => this.appDataService.updateShowLoadingPanel(false))).subscribe({
          next: (response: Session) => {
            if (response.redirect) {
              response.redirect = this.sanitizer.sanitize(SecurityContext.URL, response.redirect) || '';
              if (response.redirect) {
                this.router.navigate([response.redirect]).then();
              }
            }
            this.setSession(response);
            if (response && response && response.properties && response.properties.new_receipt) {
              const receipt = response.properties.new_receipt;
              const formattedReceipt = this.formatReceipt(receipt);

              const modalRef = this.modalService.open(OtkcAccessComponent,{backdrop: 'static', keyboard: false});
              modalRef.componentInstance.arg = {
                receipt: receipt,
                formatted_receipt: formattedReceipt
              };
              modalRef.componentInstance.confirmFunction = () => {
                this.http.put('api/whistleblower/operations', {
                  operation: 'change_receipt',
                  args: {}
                  }).subscribe(() => {
                  this.titleService.setPage('tippage');
                  modalRef.close();
                });
              };
              return;
            }

            if (this.session.role === "whistleblower") {
              if (password) {
                this.appDataService.receipt = password;
                this.titleService.setPage("tippage");
              } else if (this.session.properties.operator_session) {
                this.router.navigate(['/']);
              }
            } else {
              if (!callback) {
                this.reset();

                let redirect = this.activatedRoute.snapshot.queryParams['redirect'] || undefined;
                redirect = this.activatedRoute.snapshot.queryParams['redirect'] || '/';
                redirect = decodeURIComponent(redirect);

	        if (redirect !== "/") {
                  redirect = this.sanitizer.sanitize(SecurityContext.URL, redirect) || '';

                  // Honor only local redirects
                  if (redirect.startsWith("/")) {
                    this.router.navigate([redirect]);
                  }
                } else {
                this.router.navigate([this.session.homepage], {
                    queryParams: this.activatedRoute.snapshot.queryParams,
                    queryParamsHandling: "merge"
                  }).then();
                }
              }
            }

            if (callback) {
              callback();
            }
          },
          error: (error: HttpErrorResponse) => {
            this.loginInProgress = false;
            if (error.error && error.error["error_code"]) {
              if (error.error["error_code"] === 4) {
                this.requireAuthCode = true;
              } else if (error.error["error_code"] !== 13) {
                this.reset();
              }
            }

            this.appDataService.errorCodes = new ErrorCodes(error.error["error_message"], error.error["error_code"], error.error.arguments);
            if (callback) {
              callback();
            }
          }
        }
      );

      return requestObservable;
    } catch (error) {
      this.appDataService.updateShowLoadingPanel(false);
      return of('Failure');
    }
  }

  formatReceipt(receipt: string): string {
    if (!receipt || receipt.length !== 16) {
      return '';
    }

    return (
      receipt.substring(0, 4) + " " +
      receipt.substring(4, 8) + " " +
      receipt.substring(8, 12) + " " +
      receipt.substring(12, 16)
    );
  }

  public getHeader(confirmation?: string): HttpHeaders {
    let headers = new HttpHeaders();

    if (this.session) {
      headers = headers.set('X-Session', this.session.id);
      headers = headers.set('Accept-Language', 'en');
    }

    if (confirmation) {
      headers = headers.set('X-Confirmation', confirmation);
    }

    return headers;
  }

  logout(callback?: () => void) {
    const requestObservable = this.httpService.requestDeleteUserSession();
    requestObservable.subscribe(
      {
        next: () => {
          this.reset();
	  this.deleteSession();

          if (callback) {
            callback();
          }
        }
      }
    );
  };

  loginRedirect() {
    const source_path = location.pathname;

    if (source_path !== "/login") {
      this.router.navigateByUrl("/login").then();
    }
  };
}
