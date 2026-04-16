//! Koji receiver — `initialize` + relayer-gated `mint_koji` (Metaplex Core `CreateV1` CPI).
//! Requires **Anchor ≥ 0.31** (Solana 2.x `AccountInfo`) for `mpl-core` 0.11.

#![allow(deprecated)] // Anchor `#[program]` still calls `AccountInfo::realloc` until upstream moves to `resize`.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;
use mpl_core::instructions::CreateV1CpiBuilder;
use mpl_core::types::{
    Attribute, Attributes, Plugin, PluginAuthorityPair,
};

declare_id!("8SAWJGqo8Ku89SC2iVwua2Zcu2CWF56btDnTFEWNRNdY");

pub const MAX_RENDERER_BASE: usize = 96;

#[account]
#[derive(InitSpace)]
pub struct KojiConfig {
    pub bump: u8,
    pub relayer: Pubkey,
    #[max_len(MAX_RENDERER_BASE)]
    pub renderer_base: String,
}

#[program]
pub mod koji_receiver {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, renderer_base: String) -> Result<()> {
        require!(
            renderer_base.len() <= MAX_RENDERER_BASE,
            KojiError::RendererBaseTooLong
        );
        let cfg = &mut ctx.accounts.config;
        cfg.bump = ctx.bumps.config;
        cfg.relayer = ctx.accounts.relayer.key();
        cfg.renderer_base = renderer_base;
        Ok(())
    }

    /// Manual relayer: Metaplex Core asset + attributes (PRD §6.1).
    pub fn mint_koji(
        ctx: Context<MintKoji>,
        composition_id: u64,
        seed_lo: u128,
        seed_hi: u128,
        scale: u8,
        rhythm_density: u8,
        bpm: u16,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.config.relayer,
            ctx.accounts.relayer.key(),
            KojiError::BadRelayer
        );

        let base = ctx.accounts.config.renderer_base.trim_end_matches('/');
        let uri = format!("{}/api/composition/{}", base, composition_id);
        let name = format!("Koji #{}", composition_id);
        let seed_hex = format!("0x{:032x}{:032x}", seed_hi, seed_lo);

        let plugins = vec![PluginAuthorityPair {
            plugin: Plugin::Attributes(Attributes {
                attribute_list: vec![
                    Attribute {
                        key: "scale".into(),
                        value: scale.to_string(),
                    },
                    Attribute {
                        key: "rhythm_density".into(),
                        value: rhythm_density.to_string(),
                    },
                    Attribute {
                        key: "bpm".into(),
                        value: bpm.to_string(),
                    },
                    Attribute {
                        key: "seed".into(),
                        value: seed_hex,
                    },
                    Attribute {
                        key: "composition_id".into(),
                        value: composition_id.to_string(),
                    },
                    Attribute {
                        key: "origin_chain".into(),
                        value: "Starknet".into(),
                    },
                ],
            }),
            authority: None,
        }];

        let mpl = ctx.accounts.mpl_core_program.to_account_info();
        CreateV1CpiBuilder::new(&mpl)
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(None)
            .authority(None)
            .payer(&ctx.accounts.payer.to_account_info())
            .owner(Some(&ctx.accounts.owner.to_account_info()))
            .update_authority(None)
            .system_program(&ctx.accounts.system_program.to_account_info())
            .log_wrapper(None)
            .name(name)
            .uri(uri)
            .plugins(plugins)
            .invoke()
            .map_err(|e: ProgramError| {
                msg!("Metaplex Core CPI failed: {:?}", e);
                error!(KojiError::MplCore)
            })?;

        emit!(KojiMintedOnSolana {
            composition_id,
            recipient: ctx.accounts.owner.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + KojiConfig::INIT_SPACE,
        seeds = [b"koji_cfg"],
        bump
    )]
    pub config: Account<'info, KojiConfig>,
    pub relayer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintKoji<'info> {
    #[account(
        mut,
        seeds = [b"koji_cfg"],
        bump = config.bump,
    )]
    pub config: Account<'info, KojiConfig>,
    pub relayer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub asset: Signer<'info>,
    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    /// CHECK: NFT owner
    pub owner: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct KojiMintedOnSolana {
    pub composition_id: u64,
    pub recipient: Pubkey,
}

#[error_code]
pub enum KojiError {
    #[msg("renderer_base too long")]
    RendererBaseTooLong,
    #[msg("signer is not the configured relayer")]
    BadRelayer,
    #[msg("Metaplex Core CPI failed")]
    MplCore,
}
