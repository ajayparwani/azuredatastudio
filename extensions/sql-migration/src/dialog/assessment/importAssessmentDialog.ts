/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { MigrationStateModel } from '../../models/stateMachine';
import { SqlMigrationImpactedObjectInfo } from '../../service/contracts';
import { AssessmentDetailsBody } from '../../wizard/assessmentDetailsPage/assessmentDetialsBody';
import { AssessmentDetailsHeader } from '../../wizard/assessmentDetailsPage/assessmentDetailsHeader';
import { MigrationTargetType } from '../../api/utils';

export type Issues = {
	description: string,
	recommendation: string,
	moreInfo: string,
	impactedObjects: SqlMigrationImpactedObjectInfo[],
};
export class ImportAssessmentDialog {

	private static readonly OkButtonText: string = 'OK';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;
	private _body;
	private _bodySection!: azdata.Component;
	private _header;
	private _disposables: vscode.Disposable[] = [];

	constructor(public ownerUri: string, public model: MigrationStateModel, public title: string) {
		this._header = new AssessmentDetailsHeader(model, true);
		this._body = new AssessmentDetailsBody(model, {} as azdata.window.Wizard, true);
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {

					const pageHeading = view.modelBuilder.text().withProps({
						CSSStyles: {
							...styles.PAGE_TITLE_CSS,
							'margin': '0px 15px 0px 15px'
						},
						value: constants.ASSESSMENT_RESULTS_PAGE_HEADER
					}).component();

					const headerSection = this._header.createAssessmentDetailsHeader(view);

					this._bodySection = await this._body.createAssessmentDetailsBodyAsync(view);

					await this.shouldNoTargetSelectionDisplayAsync(this.model._targetType === undefined);

					if (this.model._targetType !== undefined) {
						await this._header.populateAssessmentDetailsHeader(this.model);
						await this._body.populateAssessmentBodyAsync();
					}

					this._disposables.push(this._header.targetTypeDropdown.onValueChanged(async (value) => {
						if (value) {
							const selectedTargetType = this.getTargetTypeBasedOnSelection(value);
							await this.shouldNoTargetSelectionDisplayAsync(false);
							this.model._targetType = selectedTargetType;
							await this._header.populateAssessmentDetailsHeader(this.model);
							await this._body.populateAssessmentBodyAsync();
						}
					}));

					const form = view.modelBuilder.formContainer()
						.withFormItems([
							{
								component: pageHeading
							},
							{
								component: headerSection
							},
							{
								component: this._bodySection
							}
						]).withProps({
							CSSStyles: { 'padding-top': '0' }
						}).component();

					this._disposables.push(view.onClosed(e => {
						this._disposables.forEach(
							d => { try { d.dispose(); } catch { } });
					}));

					await view.initializeModel(form);
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(this.title, 'AssessmentResults', 'wide');

			this.dialog.okButton.hidden = true;
			this.dialog.cancelButton.label = ImportAssessmentDialog.OkButtonText;
			this.dialog.cancelButton.position = 'left';

			const dialogSetupPromises: Thenable<void>[] = [];

			dialogSetupPromises.push(this.initializeDialog(this.dialog));

			azdata.window.openDialog(this.dialog);

			await Promise.all(dialogSetupPromises);

			await this._body.populateAssessmentBodyAsync();
		}
	}

	private async shouldNoTargetSelectionDisplayAsync(visible: boolean) {
		if (visible) {
			await utils.updateControlDisplay(this._bodySection, false);
			await utils.updateControlDisplay(this._header.headerCardsContainer, false);
			await utils.updateControlDisplay(this._header.noTargetSelectedContainer, true, 'flex');
		}
		else {
			await utils.updateControlDisplay(this._header.noTargetSelectedContainer, false);
			await utils.updateControlDisplay(this._bodySection, true, 'flex');
			await utils.updateControlDisplay(this._header.headerCardsContainer, true, 'flex');
		}
	}

	private getTargetTypeBasedOnSelection(targetType: string): MigrationTargetType {
		switch (targetType) {
			case constants.SUMMARY_SQLDB_TYPE:
				return MigrationTargetType.SQLDB;
			case constants.SUMMARY_VM_TYPE:
				return MigrationTargetType.SQLVM;
			case constants.SUMMARY_MI_TYPE:
				return MigrationTargetType.SQLMI;
			default:
				throw new Error('Unsupported type');
		}
	}
}
