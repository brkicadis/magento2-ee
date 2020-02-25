/**
 * Shop System Plugins:
 * - Terms of Use can be found under:
 * https://github.com/wirecard/magento2-ee/blob/master/_TERMS_OF_USE
 * - License can be found under:
 * https://github.com/wirecard/magento2-ee/blob/master/LICENSE
 */

/*global WPP*/
define([
    "jquery",
    "Magento_Vault/js/view/payment/method-renderer/vault",
    "mage/translate",
    "mage/url"
], function ($, VaultComponent, $t, url) {
    "use strict";

    return VaultComponent.extend({
        defaults: {
            template: "Wirecard_ElasticEngine/payment/method-vault",
        },

        settings : {
            formIdSuffix: "_seamless_token_form",
            STATE_SUCCESS_INIT_PAYMENT_AJAX: "OK",
            WPP_CLIENT_VALIDATION_ERROR_CODES: ["FE0001"],
            CREDIT_CARD_LOADING_ERROR_TRANSLATION_KEY: "credit_card_form_loading_error"
         },

        showSpinner: function () {
            $("body").trigger("processStart");
        },

        hideSpinner: function () {
            $("body").trigger("processStop");
        },

        getFormId: function() {
            return this.getId() + this.settings.formIdSuffix;
        },

        getPaymentPageScript: function () {
            return this.wppUrl;
        },

        selectPaymentMethod: function () {
            this._super();

            if($("#" + this.getId()).is(":checked") && $("#" + this.getFormId()).is(":empty")) {

                let formSizeHandler = this.seamlessFormSizeHandler.bind(this);
                let seamlessFormInitErrorHandler = this.seamlessFormInitErrorHandler.bind(this);
                let hideSpinner = this.hideSpinner.bind(this);

                let formId = this.getFormId();

                let uiInitData = {
                    txtype: this.wpp_txtype,
                    token: this.getToken(),
                };

                this.showSpinner();

                $.getScript(this.getPaymentPageScript(), function () {
                    // Build seamless renderform with full transaction data
                    $.ajax({
                        url: url.build("wirecard_elasticengine/frontend/creditcard"),
                        type: "post",
                        data: uiInitData,
                        success: function (result) {
                            if ("OK" === result.status) {
                                let uiInitData = JSON.parse(result.uiData);
                                WPP.seamlessRender({
                                    requestData: uiInitData,
                                    wrappingDivId: formId,
                                    onSuccess: formSizeHandler,
                                    onError: seamlessFormInitErrorHandler,
                                });
                            } else {
                                hideSpinner();
                                seamlessFormInitErrorHandler();
                            }
                        },
                        error: function (err) {
                            hideSpinner();
                            seamlessFormInitErrorHandler();
                        }
                    });
                });
            }

            return true;
        },

        addErrorMessageAndRedirect: function(errors) {
            if (errors.length > 0) {
                this.messageContainer.addErrorMessage({message: errors});
            }
            setTimeout(function () {
                location.reload();
            }, 3000);
        },

        seamlessFormInitErrorHandler: function (response) {
            this.hideSpinner();
            this.addErrorMessageAndRedirect([$t(this.settings.CREDIT_CARD_LOADING_ERROR_TRANSLATION_KEY)]);
        },

        seamlessFormSubmitErrorHandler: function (response) {
            let validErrorCodes = this.settings.WPP_CLIENT_VALIDATION_ERROR_CODES;

            let isClientValidation = false;
            let errorList = [];
            response.errors.forEach(
                function ( item ) {
                    if (validErrorCodes.includes(item.error.code)) {
                        isClientValidation = true;
                    } else {
                        errorList.push(item.error.description);
                    }
                }
            );
            if (!isClientValidation) {
                this.addErrorMessageAndRedirect(errorList);
            }
        },

        /**
         * Submit credit card request
         */
        seamlessFormSubmit: function() {
            WPP.seamlessSubmit({
                wrappingDivId: this.getFormId(),
                onSuccess: this.seamlessFormSubmitSuccessHandler.bind(this),
                onError: this.seamlessFormSubmitErrorHandler.bind(this)
            });
        },
        seamlessFormSubmitSuccessHandler: function (response) {
            this.seamlessResponse = response;
            this.placeOrder();
        },
        seamlessFormSizeHandler: function () {
            this.hideSpinner();
            let seamlessForm = document.getElementById(this.getFormId());
            window.addEventListener("resize", this.resizeIframe.bind(seamlessForm));
            if (seamlessForm !== null && typeof seamlessForm !== "undefined") {
                this.resizeIframe(seamlessForm);
            }
        },
        resizeIframe: function (seamlessForm) {
            let iframe = seamlessForm.firstElementChild;
            if (iframe) {
                if (iframe.clientWidth > 768) {
                    iframe.style.height = "267px";
                } else if (iframe.clientWidth > 460) {
                    iframe.style.height = "341px";
                } else {
                    iframe.style.height = "415px";
                }
            }
        },
        placeTokenSeamlessOrder: function (data, event) {
            if (event) {
                event.preventDefault();
            }
            this.seamlessFormSubmit();
        },
        /**
         * Get last 4 digits of card
         * @returns {String}
         */
        getMaskedCard: function () {
            return this.details.maskedCC;
        },

        /**
         * Get expiration date
         * @returns {String}
         */
        getExpirationDate: function () {
            return this.details.expirationDate;
        },

        /**
         * Get card type
         * @returns {String}
         */
        getCardType: function () {
            return this.details.type;
        },

        /**
         * @returns {String}
         */
        getToken: function () {
            return this.publicHash;
        },

        getData: function () {
            var result = null;
            $.ajax({
                url: url.build("wirecard_elasticengine/frontend/vault?hash="+this.getToken()),
                type: "GET",
                dataType: "json",
                async: false,
                success: function (data) {
                    result = data;
                }
            });

            return {
                "method": result.method_code,
                "po_number": null,
                "additional_data": {
                    "token_id": result.token_id,
                    "recurring_payment" : true
                }
            };
        },
    });
});
